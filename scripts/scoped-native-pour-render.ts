import assert from "node:assert/strict"
import {parseAltiumBinaryPcbDoc} from "../node_modules/altiumts"
import {convertAltiumPcbDocToCircuitJson} from "../lib"
import {convertCircuitJsonToTscircuit} from "../runtime-converter/lib"
import {renderConvertedBoard} from "../runtime-converter/tests/fixtures/render-converted-board"
const boards={21:"ti-pmp23595.PcbDoc",22:"ti-pmp23653-main.PcbDoc",23:"ti-pmp23653-planar-transformer.PcbDoc",24:"ti-pmp22650-main.PcbDoc",25:"ti-pmp22712.PcbDoc",26:"ti-pmp22773.PcbDoc"}
const sample=Number(process.env.TI_SAMPLE)
const started=performance.now()
try{
 const document=parseAltiumBinaryPcbDoc(new Uint8Array(await Bun.file("../tests/fixtures/downloaded/"+boards[sample]).arrayBuffer()))
 const input=convertAltiumPcbDocToCircuitJson(document,{copperPourMode:"recompute",includeTraces:false,includeVias:false,includeCadModels:false})
 const definitions=input.filter(e=>e.type==="pcb_copper_pour")
 assert(!input.some(e=>e.type==="pcb_trace"||e.type==="pcb_via"))
 const tsx=convertCircuitJsonToTscircuit(input,{componentName:"ImportedBoard",copperPourMode:"recompute"}).replace("<board","<board routingDisabled")
 const converted=performance.now()
 const output=await renderConvertedBoard(tsx)
 const pours=output.filter(e=>e.type==="pcb_copper_pour")
 const errors=output.filter(e=>e.type.endsWith("_error"))
 assert(pours.length>0,"Core must compute copper from imported definitions")
 assert(pours.filter(p=>p.is_static).length>=definitions.filter(p=>p.is_static).length,"Authored fixed copper must survive")
 assert(!output.some(e=>e.type==="pcb_trace"),"This control isolates fresh copper computation from autorouting")
 const result={sample,status:"computed",mode:"pour_only_control",inputPours:definitions.length,computedPours:pours.length,staticPours:pours.filter(p=>p.is_static).length,poursWithClearanceRules:pours.filter(p=>p.clearance_rules!==undefined).length,errors:Object.fromEntries([...new Set(errors.map(e=>e.type))].map(type=>[type,errors.filter(e=>e.type===type).length])),conversionMs:Math.round(converted-started),renderMs:Math.round(performance.now()-converted)}
 console.log("TI_NATIVE_POUR_RESULT "+JSON.stringify(result))
 assert(errors.length===0,"Core reported errors while computing native copper")
}catch(error){console.log("TI_NATIVE_POUR_RESULT "+JSON.stringify({sample,status:"failed",mode:"pour_only_control",error:String(error),elapsedMs:Math.round(performance.now()-started)}));process.exitCode=1}
