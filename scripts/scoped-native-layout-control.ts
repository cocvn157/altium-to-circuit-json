import {parseAltiumBinaryPcbDoc} from "../node_modules/altiumts"
import {convertAltiumPcbDocToCircuitJson} from "../lib"
import {convertCircuitJsonToTscircuit} from "../runtime-converter/lib"
import {renderConvertedBoard} from "../runtime-converter/tests/fixtures/render-converted-board"
const boards={21:"ti-pmp23595.PcbDoc",22:"ti-pmp23653-main.PcbDoc",23:"ti-pmp23653-planar-transformer.PcbDoc",24:"ti-pmp22650-main.PcbDoc",25:"ti-pmp22712.PcbDoc",26:"ti-pmp22773.PcbDoc"}
const sample=Number(process.env.TI_SAMPLE),started=performance.now()
try{
 const document=parseAltiumBinaryPcbDoc(new Uint8Array(await Bun.file("../tests/fixtures/downloaded/"+boards[sample]).arrayBuffer()))
 const input=convertAltiumPcbDocToCircuitJson(document,{includeCopperAreas:false,includeTraces:false,includeVias:false,includeCadModels:false})
 const tsx=convertCircuitJsonToTscircuit(input,{componentName:"ImportedBoard"}).replace("<board","<board routingDisabled")
 const converted=performance.now()
 const output=await renderConvertedBoard(tsx)
 const errors=output.filter(e=>e.type.endsWith("_error"))
 console.log("TI_LAYOUT_CONTROL "+JSON.stringify({sample,status:"rendered",mode:"no_copper_layout_control",tsxCharacters:tsx.length,pcbComponents:output.filter(e=>e.type==="pcb_component").length,errors:Object.fromEntries([...new Set(errors.map(e=>e.type))].map(type=>[type,errors.filter(e=>e.type===type).length])),conversionMs:Math.round(converted-started),renderMs:Math.round(performance.now()-converted)}))
}catch(error){console.log("TI_LAYOUT_CONTROL "+JSON.stringify({sample,status:"failed",error:String(error)}));process.exitCode=1}
