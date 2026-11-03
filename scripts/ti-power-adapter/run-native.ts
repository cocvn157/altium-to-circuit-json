import { mkdir } from "node:fs/promises"
import { parseAltiumBinaryPcbDoc } from "altiumts"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkCopperPourShorts, checkCopperToBoardEdgeClearance, checkCopperToCutoutClearance } from "@tscircuit/checks"
import { renderBoard } from "./render-board"

const files: Record<number, string> = {21:"ti-pmp23595.PcbDoc",22:"ti-pmp23653-main.PcbDoc",23:"ti-pmp23653-planar-transformer.PcbDoc",24:"ti-pmp22650-main.PcbDoc",25:"ti-pmp22712.PcbDoc",26:"ti-pmp22773.PcbDoc"}
const sample=Number(process.env.TI_SAMPLE)
const started=performance.now()
const stage=(name:string,details:Record<string,unknown>={})=>console.log("TI_ADAPTER_STAGE "+JSON.stringify({sample,name,elapsedMs:Math.round(performance.now()-started),...details}))
await mkdir("results",{recursive:true})
try {
  const document=parseAltiumBinaryPcbDoc(new Uint8Array(await Bun.file(`../../tests/fixtures/downloaded/${files[sample]}`).arrayBuffer()))
  const output=await renderBoard(document,{routingDisabled:process.env.TI_ROUTE!=="1",stage})
  const shorts=checkCopperPourShorts(output.circuitJson)
  const fixedIds=new Set(output.pours.filter(p=>!p.pcb_copper_pour_id.includes("_computed_")).map(p=>p.pcb_copper_pour_id))
  const fixedOnly=output.circuitJson.filter(e=>e.type!=="pcb_copper_pour"||fixedIds.has(e.pcb_copper_pour_id))
  const fixedShorts=checkCopperPourShorts(fixedOnly)
  const beforeEdges=checkCopperToBoardEdgeClearance(output.baseline)
  const afterEdges=checkCopperToBoardEdgeClearance(output.circuitJson)
  const beforeCutouts=checkCopperToCutoutClearance(output.baseline)
  const afterCutouts=checkCopperToCutoutClearance(output.circuitJson)
  const counts=(elements:{type:string}[])=>Object.fromEntries([...new Set(elements.map(e=>e.type))].map(type=>[type,elements.filter(e=>e.type===type).length]))
  const errors=output.circuitJson.filter(e=>e.type.endsWith("_error"))
  const routingErrors=errors.filter(e=>/autorouting|trace|port_not_connected|via_clearance/u.test(e.type))
  const report={sample,routingEnabled:process.env.TI_ROUTE==="1",definitions:output.definitions,fixed:output.fixed,pours:output.pours.length,traces:output.circuitJson.filter(e=>e.type==="pcb_trace").length,shorts:shorts.length,fixedShorts:fixedShorts.length,addedShorts:shorts.length-fixedShorts.length,removedIslands:output.removedIslands,addedBoardEdgeErrors:afterEdges.length-beforeEdges.length,addedCutoutErrors:afterCutouts.length-beforeCutouts.length,errors:counts(errors),routingErrors:counts(routingErrors),autoroutingMessages:routingErrors.filter(e=>e.type==="pcb_autorouting_error").map(e=>e.message.slice(0,2000)),shortMessages:shorts.slice(0,3).map(e=>e.message.slice(0,500)),elapsedMs:Math.round(performance.now()-started)}
  await Bun.write(`results/${sample}-report.json`,JSON.stringify(report,null,2))
  const board=output.circuitJson.find(e=>e.type==="pcb_board")!
  if (board.type!=="pcb_board"||!board.outline?.length) throw new Error("Missing rendered board outline")
  const xs=board.outline.map(p=>p.x),ys=board.outline.map(p=>p.y)
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),margin=Math.max(maxX-minX,maxY-minY)*.05
  const svg=convertCircuitJsonToPcbSvg(output.circuitJson,{width:1800,height:1200,backgroundColor:"#0b171a",includeVersion:false,showSolderMask:false,showSolderPaste:false,showCourtyards:false,shouldDrawRatsNest:false,shouldDrawErrors:false,showPcbNotes:false,showFabricationNotes:false,showPcbGroups:false,drawPaddingOutsideBoard:true,colorOverrides:{drill:"#0b171a",boardOutline:"#526f60"},viewport:{minX:minX-margin,maxX:maxX+margin,minY:minY-margin,maxY:maxY+margin}})
  await Bun.write(`results/${sample}-routed.svg`,svg)
  stage("finished",report)
  if (shorts.length||routingErrors.length||!output.pours.length) process.exitCode=1
} catch(error) {
  stage("failed",{error:String(error)})
  process.exitCode=1
}
