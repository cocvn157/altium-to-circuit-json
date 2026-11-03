import { parseAltiumBinaryPcbDoc } from "altiumts"
import { readBoard } from "./read-board"
const sample=Number(process.env.TI_SAMPLE)
const names:Record<number,string>={21:"ti-pmp23595.PcbDoc",24:"ti-pmp22650-main.PcbDoc"}
const document=parseAltiumBinaryPcbDoc(new Uint8Array(await Bun.file(`../../tests/fixtures/downloaded/${names[sample]}`).arrayBuffer()))
const imported=readBoard(document)
const kinds=new Set(["CLEARANCE","BOARDOUTLINECLEARANCE","HOLETOHOLECLEARANCE","HOLESIZE","ROUTINGVIAS","WIDTH"])
const rules=document.rules.filter(r=>r.enabled!==false&&kinds.has(r.ruleKind?.toUpperCase()??"")).map(r=>({kind:r.ruleKind,priority:r.priority,scope1:r.scope1Expression,scope2:r.scope2Expression,clearanceMils:r.clearanceMils,netScope:r.get("NETSCOPE"),layerKind:r.get("LAYERKIND"),matrix:r.get("OBJECTCLEARANCES")}))
const fixed=imported.definitions.filter(d=>d.fixed).map(d=>({id:d.copper.pcb_copper_pour_id,net:d.identity.netName,layer:d.identity.layer,shape:d.copper.shape}))
const board=imported.circuitJson.find(e=>e.type==="pcb_board")
console.log("TI_NATIVE_ROUTING_RULES "+JSON.stringify({sample,rules,fixed,board:board?Object.fromEntries(Object.entries(board).filter(([k])=>k.startsWith("min_")||k.startsWith("allow_")||k.startsWith("is_via"))):undefined}))
