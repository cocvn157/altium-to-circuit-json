import { createRequire } from "node:module"
import { transpileModule, ModuleKind, JsxEmit } from "typescript"
import { RootCircuit } from "@tscircuit/core"
import type { AltiumPcbDocument } from "altiumts"
import { convertCircuitJsonToTscircuit } from "circuit-json-to-tscircuit"
import { createBoardConversionContext } from "tsx-source/board-conversion-context"
import { readBoard } from "./read-board"
import { computePours } from "./compute-pours"
import { ImportedKeepouts } from "./ImportedKeepouts"
import { expandSharedPadPorts } from "./expand-shared-pad-ports"

export async function renderBoard(document: AltiumPcbDocument, options: {
  routingDisabled?: boolean
  stage?: (name: string, details?: Record<string, unknown>) => void
} = {}) {
  const imported = readBoard(document)
  const board = imported.circuitJson.find(e => e.type === "pcb_board")
  if (!board || board.type !== "pcb_board") throw new Error("No imported board")
  const routingProperties = Object.entries({
    minTraceWidth: board.min_trace_width,
    minViaHoleDiameter: board.min_via_hole_diameter,
    minViaPadDiameter: board.min_via_pad_diameter,
    isViaInPadAllowed: board.is_via_in_pad_allowed,
    allowBlindAndBuriedVias: board.allow_blind_and_buried_vias,
  }).filter(([, value]) => value !== undefined).map(([name, value]) => `${name}={${JSON.stringify(value)}}`).join(" ")
  const keepouts = imported.circuitJson.filter(e => e.type === "pcb_keepout")
  const circuitJson = expandSharedPadPorts([...imported.circuitJson.filter(e => e.type !== "pcb_keepout"), ...imported.definitions.map(d => d.copper)])
  const context = createBoardConversionContext({ circuitJson })
  let tsx = convertCircuitJsonToTscircuit(circuitJson, { componentName: "ImportedBoard", copperPourMode: "preserve" })
  for (const net of imported.circuitJson) if (net.type === "source_net" && net.trace_width !== undefined) {
    const name = context.runtimeNetNameBySourceNetId.get(net.source_net_id) ?? net.name
    const opening = `<net name={${JSON.stringify(name)}}`
    tsx = tsx.replace(opening, `${opening} nominalTraceWidth={${net.trace_width}}`)
  }
  let pourIndex = 0
  const netlistOnly = circuitJson.filter(e => e.type === "source_trace").every(e => e.connected_source_net_ids.length === 1)
  const routingTsx = tsx.split("\n").filter(line => {
    // The exporter emits each imported net as both a net membership list and
    // a trace path. Net declarations already connect every authored terminal.
    if (netlistOnly && line.trimStart().startsWith("<trace path=")) return false
    if (!line.trimStart().startsWith("<copperpour ")) return true
    const definition = imported.definitions[pourIndex++]
    if (!definition) throw new Error("Generated pour order no longer matches the import")
    return definition.fixed
  }).map(line => line.trimStart().startsWith("<copperpour ") ? line.replace("<copperpour ", "<copperpour unbroken ") : line).join("\n")
    .replace("<board", `<board ${routingProperties} ${options.routingDisabled ? "routingDisabled" : 'autorouter="auto-local" routeRemaining={true} placementDrcChecksDisabled'}`)
  if (pourIndex !== imported.definitions.length) throw new Error("A copper definition was omitted from TSX")
  options.stage?.("converted", { definitions: imported.definitions.length, fixed: imported.definitions.filter(d => d.fixed).length, tsxCharacters: routingTsx.length })
  const compiled = transpileModule(routingTsx, { compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX } }).outputText
  const exports: { default?: () => Parameters<RootCircuit["add"]>[0] } = {}
  new Function("require", "exports", compiled)(createRequire(import.meta.url), exports)
  if (!exports.default) throw new Error("No converted TSX component")
  const circuit = new RootCircuit()
  circuit.on("solver:started", event => options.stage?.("solver_started", { solver: event.solverName }))
  circuit.add(exports.default())
  circuit._getBoard()!.add(new ImportedKeepouts({keepouts}))
  await circuit.renderUntilSettled()
  const rendered = circuit.getCircuitJson().filter(e => e.type !== "pcb_copper_pour").map(element => element.type !== "pcb_trace" ? element : {
    ...element, route: element.route.map(point => {
      if (point.route_type !== "wire") return point
      const { is_inside_copper_pour, copper_pour_id, ...wire } = point
      return wire
    }),
  })
  options.stage?.("core_rendered", { traces: rendered.filter(e => e.type === "pcb_trace").length })
  const result = await computePours({
    circuitJson: rendered, definitions: imported.definitions, rules: imported.rules,
    runtimeNames: context.runtimeNetNameBySourceNetId,
    originalNetNames: new Map(imported.circuitJson.filter(e => e.type === "source_net").map(e => [e.source_net_id, e.name])),
  })
  options.stage?.("poured", { pours: result.pours.length })
  return { ...result, baseline: rendered, sourceControl: [...imported.circuitJson, ...imported.definitions.filter(d => d.fixed).map(d => d.copper)], runtimeNames: context.runtimeNetNameBySourceNetId, tsx: routingTsx }
}
