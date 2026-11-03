import assert from "node:assert/strict"
import {createRequire} from "node:module"
import {JsxEmit,ModuleKind,transpileModule} from "../runtime-converter/node_modules/typescript"
import {RootCircuit} from "../runtime-converter/node_modules/@tscircuit/core"
import {parseAltiumBinaryPcbDoc} from "../node_modules/altiumts"
import {convertAltiumPcbDocToCircuitJson} from "../lib"
import {convertCircuitJsonToTscircuit} from "../runtime-converter/lib"
const boards={21:"ti-pmp23595.PcbDoc",22:"ti-pmp23653-main.PcbDoc",23:"ti-pmp23653-planar-transformer.PcbDoc",24:"ti-pmp22650-main.PcbDoc",25:"ti-pmp22712.PcbDoc",26:"ti-pmp22773.PcbDoc"}
const baseline={21:{pcb_component_outside_board_error:18,pcb_courtyard_overlap_error:9},22:{pcb_component_outside_board_error:6,pcb_footprint_overlap_error:1},23:{pcb_component_outside_board_error:4},24:{pcb_component_outside_board_error:7,pcb_placement_error:6,pcb_footprint_overlap_error:6,pcb_courtyard_overlap_error:174},25:{pcb_component_outside_board_error:7,pcb_courtyard_overlap_error:2},26:{pcb_component_outside_board_error:1,pcb_courtyard_overlap_error:1}}
const sample=Number(process.env.TI_SAMPLE),started=performance.now()
const stage=(name,counts={})=>console.log("TI_POUR_STAGE "+JSON.stringify({sample,name,elapsedMs:Math.round(performance.now()-started),...counts}))
try{
 const document=parseAltiumBinaryPcbDoc(new Uint8Array(await Bun.file("../tests/fixtures/downloaded/"+boards[sample]).arrayBuffer()))
 const input=convertAltiumPcbDocToCircuitJson(document,{copperPourMode:"recompute",includeTraces:false,includeVias:false,includeCadModels:false})
 const definitions=input.filter(e=>e.type==="pcb_copper_pour")
 stage("converted",{definitions:definitions.length})
 const tsx=convertCircuitJsonToTscircuit(input,{componentName:"ImportedBoard",copperPourMode:"recompute"}).replace("<board","<board routingDisabled")
 stage("generated_tsx",{characters:tsx.length})
 const compiled=transpileModule(tsx,{compilerOptions:{module:ModuleKind.CommonJS,jsx:JsxEmit.ReactJSX}}).outputText
 const exports={}
 new Function("require","exports",compiled)(createRequire(new URL("../runtime-converter/native-consumer.ts",import.meta.url)),exports)
 const circuit=new RootCircuit()
 let copperSolverStarts=0, reportedCopperEnd=false
 circuit.on("solver:started",event=>{if(event.solverName==="CopperPourPipelineSolver"){copperSolverStarts++;stage("copper_solver_started",{regions:event.solverParams.regionsForPour.length,pads:event.solverParams.pads.length})}})
 circuit.on("asyncEffect:end",event=>{if(event.effectName==="PcbCopperPourRender"&&copperSolverStarts===1&&!reportedCopperEnd){reportedCopperEnd=true;stage("copper_effect_finished")}})
 circuit.add(exports.default())
 stage("created_core")
 await circuit.renderUntilSettled()
 const output=circuit.getCircuitJson(),pours=output.filter(e=>e.type==="pcb_copper_pour"),errors=output.filter(e=>e.type.endsWith("_error"))
 const errorCounts=Object.fromEntries([...new Set(errors.map(e=>e.type))].map(type=>[type,errors.filter(e=>e.type===type).length]))
 const addedErrors=Object.fromEntries(Object.entries(errorCounts).filter(([type,count])=>count>(baseline[sample][type]??0)))
 const placementCategories={}
 for(const error of errors.filter(e=>e.type==="pcb_placement_error")){
  const message=error.message??""
  const category=message.includes("clearance to cutout")?"copper_to_cutout":message.includes("copper-to-board-edge clearance")?"copper_to_board_edge":message.includes("Cannot verify copper")?"unsupported_copper_geometry":"other_placement"
  placementCategories[category]=(placementCategories[category]??0)+1
 }
 const clearanceDiagnostics=errors.filter(e=>e.minimum_clearance!==undefined).map(e=>({required:e.minimum_clearance,actual:e.actual_clearance??e.measured_clearance??e.clearance}))
 const result={clearanceDiagnostics,sample,status:"computed",mode:"pour_only_control",inputPours:definitions.length,computedPours:pours.length,staticPours:pours.filter(p=>p.is_static).length,copperSolverStarts,errorCounts,placementCategories,addedErrors,elapsedMs:Math.round(performance.now()-started)}
 console.log("TI_NATIVE_POUR_RESULT "+JSON.stringify(result))
 assert(pours.length>0)
 assert(pours.filter(p=>p.is_static).length>=definitions.filter(p=>p.is_static).length)
 assert(copperSolverStarts===1)
 assert(Object.keys(addedErrors).length===0,"Additional diagnostics need investigation")
}catch(error){console.log("TI_NATIVE_POUR_RESULT "+JSON.stringify({sample,status:"failed",error:String(error),elapsedMs:Math.round(performance.now()-started)}));process.exitCode=1}
