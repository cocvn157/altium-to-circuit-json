import { readFile, writeFile, unlink } from "node:fs/promises"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import { dirname, join } from "node:path"
import { AutoroutingPipelineSolver } from "@tscircuit/capacity-autorouter"

// Diagnostic-only: no input changes and no alternate routing strategy.
let captured: any
let failure: unknown
let lastPhase = ""
const seen = new WeakSet<object>()

function describeSolver(node: any, depth = 0): unknown {
  if (!node || typeof node !== "object" || seen.has(node) || depth > 7) return undefined
  seen.add(node)
  const primitive = (value: unknown) => value === null || ["string", "number", "boolean"].includes(typeof value)
  const state = node.state && typeof node.state === "object" ? Object.fromEntries(Object.entries(node.state).filter(([key, value]) => primitive(value) && !/^(x|y|center|candidate)$/u.test(key))) : undefined
  const childKeys = ["activeSubSolver", "portPointPathingSolver", "tinyPipelineSolver", "tinySolver", "graphSolver", "greedyFinalRouteSolver", "finalRouteSolver", "initialVisualizationSolver"]
  const children = childKeys.flatMap(key => {
    const child = node[key]
    return child && typeof child.step === "function" ? [{ key, detail: describeSolver(child, depth + 1) }] : []
  })
  const routeId = node.state?.currentRouteId
  const problem = node.problem
  const routeNames = typeof routeId === "number" && problem ? Object.entries(problem).flatMap(([key, value]) => {
    const item = Array.isArray(value) ? value[routeId] : undefined
    return typeof item === "string" && /route|connection/iu.test(key) ? [{ key, value: item }] : []
  }) : undefined
  return { className: node.constructor?.name, iterations: node.iterations, maxIterations: node.MAX_ITERATIONS, failed: node.failed, solved: node.solved, error: node.error, state, keys: Object.keys(node), problemKeys: problem ? Object.keys(problem) : undefined, routeNames, children }
}

export function installRoutingProbe() {
  const prototype = AutoroutingPipelineSolver.prototype
  const step = prototype.step
  Object.defineProperty(prototype, "step", { value: function(this: any, ...args: unknown[]) {
    try {
      return Reflect.apply(step, this, args)
    } finally {
      const phase = this.getCurrentPhase()
      if (phase !== lastPhase) {
        lastPhase = phase
        console.log("TI_ROUTING_PHASE " + JSON.stringify({phase, iterations:this.iterations}))
      }
      if (this.failed && !failure) {
        failure = describeSolver(this)
        console.log("TI_ROUTING_FAILURE " + JSON.stringify(failure))
      }
    }
  } })
  const output = prototype.getOutputSimplifiedPcbTraces
  Object.defineProperty(prototype, "getOutputSimplifiedPcbTraces", { value: function(this: any, ...args: unknown[]) {
    const traces = Reflect.apply(output, this, args)
    if (this.solved && !captured) {
      captured = {input: structuredClone(this.originalSrj), pairs: structuredClone(this.srjWithPointPairs), traces: structuredClone(traces), phases: structuredClone(this.timeSpentOnPhase)}
    }
    return traces
  } })
}

export async function getRoutingProbeReport(input: {circuitJson: any[]; errors: any[]}) {
  if (!captured) return {failure, outputCaptured:false}
  // Load a diagnostic copy only after routing finishes, preserving the router's
  // original module initialization and random state during the solve.
  const entry = createRequire(import.meta.url).resolve("@tscircuit/capacity-autorouter")
  const source = await readFile(entry, "utf8")
  const definition = "function sR(e,t,n={}){const{minTraceWidth:o=.1,minViaDiameter:i,minViaHoleDiameter:r,originalSrj:s,includeOriginalConnections:a=!1}"
  if (!source.includes(definition) || !source.includes("Wte=({inputSrj:")) throw new Error("Published diagnostic export no longer matches pinned 0.0.1035")
  const diagnosticEntry = join(dirname(entry), "ti-diagnostic-exports.js")
  await writeFile(diagnosticEntry, source + "\nexport {Wte as diagnosticCreateDrcEvaluator};\n")
  // SolverRuntime registers constructors globally. Evaluate the unchanged
  // published functions in a child process to avoid duplicate registrations.
  const evaluatorEntry = join(dirname(entry), "ti-evaluate-routing.mjs")
  await writeFile(evaluatorEntry, `
    const {diagnosticCreateDrcEvaluator}=await import(${JSON.stringify(pathToFileURL(diagnosticEntry).href)});
    const data=JSON.parse(await Bun.file(process.argv[2]).text());
    const result=diagnosticCreateDrcEvaluator({inputSrj:data.input,srjWithPointPairs:data.pairs,includeBoardClearance:true})(data.traces);
    console.log(JSON.stringify({errors:result.errors.length,viaPadErrors:result.errors.filter(error=>error.type==="pcb_pad_pad_clearance_error"||error.type==="pcb_placement_error").slice(0,8).map(error=>({type:error.type,id:error.pcb_pad_pad_clearance_error_id??error.pcb_placement_error_id,message:error.message}))}));
  `)
  const payloadEntry=join(dirname(entry),"ti-routing-diagnostic-private.json")
  await writeFile(payloadEntry,JSON.stringify(captured),{mode:0o600})
  const child = Bun.spawn([process.execPath, evaluatorEntry,payloadEntry], {stdin:"ignore",stdout:"pipe",stderr:"pipe"})
  const [stdout,stderr,exitCode]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited])
  await unlink(payloadEntry)
  if(exitCode!==0)throw new Error(`Published diagnostic evaluation failed: ${stderr.slice(0,2000)}`)
  const evaluation=JSON.parse(stdout)
  const viaPoints = captured.traces.flatMap((trace: any) => trace.route.filter((point: any) => point.route_type === "via").map((point: any) => ({trace,point})))
  const viaComparisons = input.errors.filter(error => error.type === "pcb_pad_pad_clearance_error" && error.pcb_pad_pad_clearance_error_id.startsWith("via_pad_clearance_")).flatMap(error => {
    const pair = error.pcb_pad_ids.map((id: string) => input.circuitJson.find(element => Object.values(element).includes(id)))
    const via = pair.find((element: any) => element?.type === "pcb_via")
    const pad = pair.find((element: any) => element?.type === "pcb_smtpad" || element?.type === "pcb_plated_hole")
    if (!via || !pad) return []
    const nearest = viaPoints.map((item: any) => ({...item,distance:Math.hypot(item.point.x-via.x,item.point.y-via.y)})).sort((a: any,b: any)=>a.distance-b.distance)[0]
    return [{message:error.message,coreDiameter:via.outer_diameter,coreHole:via.hole_diameter,coreLayers:via.layers,padWidth:pad.width,padHeight:pad.height,padRotation:pad.ccw_rotation,padCornerRadius:pad.corner_radius,relativeOffset:{x:via.x-pad.x,y:via.y-pad.y},nearestRawVia:nearest?{distance:nearest.distance,connection:nearest.trace.connection_name,diameter:nearest.point.via_diameter,outerDiameter:nearest.point.outer_diameter,hole:nearest.point.via_hole_diameter,fromLayer:nearest.point.from_layer,toLayer:nearest.point.to_layer,physicalLayers:nearest.point.layers}:undefined}]
  })
  return {outputCaptured:true,phases:captured.phases,rawViaCount:viaPoints.length,ownDrcErrors:evaluation.errors,ownViaPadErrors:evaluation.viaPadErrors,viaComparisons}
}
