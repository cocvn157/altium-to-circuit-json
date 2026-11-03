import assert from "node:assert/strict"
import {parseAltiumBinaryPcbDoc} from "altiumts"
import {convertAltiumPcbDocToCircuitJson} from "../lib"
const boards=[{sample:21,file:"ti-pmp23595.PcbDoc"},{sample:22,file:"ti-pmp23653-main.PcbDoc"},{sample:23,file:"ti-pmp23653-planar-transformer.PcbDoc"},{sample:24,file:"ti-pmp22650-main.PcbDoc"},{sample:25,file:"ti-pmp22712.PcbDoc"},{sample:26,file:"ti-pmp22773.PcbDoc"}]
for(const board of boards){
 const started=performance.now()
 try{
  const document=parseAltiumBinaryPcbDoc(new Uint8Array(await Bun.file("tests/fixtures/downloaded/"+board.file).arrayBuffer()))
  const circuit=convertAltiumPcbDocToCircuitJson(document,{copperPourMode:"recompute",includeTraces:false,includeVias:false,includeCadModels:false})
  const pours=circuit.filter(e=>e.type==="pcb_copper_pour")
  assert(pours.length>0)
  assert(pours.every(p=>Number.isFinite(p.clearance)&&p.clearance_rules!==undefined))
  assert(!circuit.some(e=>e.type==="pcb_trace"||e.type==="pcb_via"))
  const result={...board,status:"converted",pours:pours.length,static:pours.filter(p=>p.is_static).length,ruleCount:pours.reduce((n,p)=>n+p.clearance_rules!.length,0),edgeMargins:[...new Set(pours.filter(p=>!p.is_static).map(p=>p.board_edge_margin))],clearances:[...new Set(pours.flatMap(p=>[p.clearance,...p.clearance_rules!.map(r=>r.clearance)]))],elapsedMs:Math.round(performance.now()-started)}
  console.log("SCOPED_NATIVE_RESULT "+JSON.stringify(result))
 }catch(error){console.log("SCOPED_NATIVE_RESULT "+JSON.stringify({...board,status:"failed",error:String(error)}));process.exitCode=1}
}
