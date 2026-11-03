import { createHash } from "node:crypto"
import { parseAltiumBinaryPcbDoc } from "altiumts"
import { RootCircuit, getSimpleRouteJsonFromCircuitJson } from "@tscircuit/core"
import { readBoard } from "./read-board"
import { renderBoard } from "./render-board"
import { createBoardConversionContext } from "tsx-source/board-conversion-context"

const bytes = new Uint8Array(await Bun.file("../../tests/fixtures/downloaded/ti-pmp22650-main.PcbDoc").arrayBuffer())
const document = parseAltiumBinaryPcbDoc(bytes)
const source = readBoard(document).circuitJson
const originalNames = new Map(source.filter(e=>e.type==="source_net").map(e=>[e.source_net_id,e.name]))
const context=createBoardConversionContext({circuitJson:source})
const originalNameByRuntime=new Map([...originalNames].map(([id,name])=>[context.runtimeNetNameBySourceNetId.get(id)??name,name]))
const before = getSimpleRouteJsonFromCircuitJson({circuitJson:source}).simpleRouteJson
const originalEmit = RootCircuit.prototype.emit
const counter = values => { const map = new Map();for(const value of values)map.set(value,(map.get(value)??0)+1);return map }
const difference = (a,b) => [...a].flatMap(([key,n])=>Array(Math.max(0,n-(b.get(key)??0))).fill(key))
const round = n => Math.round(n*1e6)/1e6
const normalize = (srj,names) => ({
  connections:counter(srj.connections.map(c=>JSON.stringify([names.get(c.name)??c.name,c.nominalTraceWidth,c.width,c.pointsToConnect.map(p=>[round(p.x),round(p.y),p.layers??[p.layer]]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))]))),
  obstacles:counter(srj.obstacles.map(o=>JSON.stringify([o.type,round(o.center.x),round(o.center.y),round(o.width),round(o.height),[...o.layers].sort(),o.connectedTo.flatMap(id=>names.has(id)?[names.get(id)]:[]).sort()]))),
})
Object.defineProperty(RootCircuit.prototype,"emit",{value:function(name,event){
  if(name!=="autorouting:start")return Reflect.apply(originalEmit,this,[name,event])
  const rendered=this.db.toArray()
  const runtimeNames=new Map(rendered.filter(e=>e.type==="source_net").map(e=>[e.source_net_id,originalNameByRuntime.get(e.name)??e.name]))
  const a=normalize(before,originalNames),b=normalize(event.simpleRouteJson,runtimeNames)
  const missingConnections=difference(a.connections,b.connections),extraConnections=difference(b.connections,a.connections)
  const missingObstacles=difference(a.obstacles,b.obstacles),extraObstacles=difference(b.obstacles,a.obstacles)
  const sourcePortByHint=new Map([...context.portHintByPcbPortId].map(([id,hint])=>[hint,source.find(e=>e.type==="pcb_port"&&e.pcb_port_id===id)]))
  const sourcePrimitiveByPort=new Map(source.filter(e=>(e.type==="pcb_smtpad"||e.type==="pcb_plated_hole")&&e.pcb_port_id).map(e=>[e.pcb_port_id,e]))
  const deltas=[]
  for(const pad of rendered){
    if(pad.type!=="pcb_smtpad"&&pad.type!=="pcb_plated_hole")continue
    const hint=pad.port_hints?.find(h=>sourcePortByHint.has(h)),oldPort=hint?sourcePortByHint.get(hint):undefined
    const old=oldPort?sourcePrimitiveByPort.get(oldPort.pcb_port_id):undefined
    if(!old)continue
    const centerDelta=Math.hypot(pad.x-old.x,pad.y-old.y)
    const sizeDelta=Math.max(0,...["width","height","radius","outer_diameter","hole_diameter","outer_width","outer_height","hole_width","hole_height","rect_pad_width","rect_pad_height"].flatMap(k=>typeof pad[k]==="number"&&typeof old[k]==="number"?[Math.abs(pad[k]-old[k])]:[]))
    const owner=source.find(e=>e.type==="pcb_component"&&e.pcb_component_id===old.pcb_component_id)
    const component=owner?source.find(e=>e.type==="source_component"&&e.source_component_id===owner.source_component_id):undefined
    deltas.push({name:`${component?.name??"standalone"}.${old.port_hints?.[0]??"pad"}`,centerDelta,sizeDelta})
  }
  console.log("TI_INPUT_AUDIT "+JSON.stringify({
    sourceConnections:before.connections.length,coreConnections:event.simpleRouteJson.connections.length,
    sourceTerminals:before.connections.reduce((n,c)=>n+c.pointsToConnect.length,0),coreTerminals:event.simpleRouteJson.connections.reduce((n,c)=>n+c.pointsToConnect.length,0),
    sourceObstacles:before.obstacles.length,coreObstacles:event.simpleRouteJson.obstacles.length,
    missingConnections:missingConnections.length,extraConnections:extraConnections.length,missingObstacles:missingObstacles.length,extraObstacles:extraObstacles.length,
    missingConnectionNames:missingConnections.map(k=>JSON.parse(k)[0]),extraConnectionNames:extraConnections.map(k=>JSON.parse(k)[0]),
    missingObstacleNets:missingObstacles.map(k=>JSON.parse(k).at(-1)),extraObstacleNets:extraObstacles.map(k=>JSON.parse(k).at(-1)),
    comparedPads:deltas.length,maxPadCenterDelta:Math.max(...deltas.map(d=>d.centerDelta)),maxPadSizeDelta:Math.max(...deltas.map(d=>d.sizeDelta)),changedPads:deltas.filter(d=>d.centerDelta>1e-8||d.sizeDelta>1e-8),
    sourcePcbDocSha256:createHash("sha256").update(bytes).digest("hex"),
  }))
  throw new Error("Intentional audit stop before routing")
}})
try{await renderBoard(document,{stage(name){if(name==="core_rendered")throw new Error("Input audit complete")}})}catch(error){if(!String(error).includes("Input audit complete"))throw error}
