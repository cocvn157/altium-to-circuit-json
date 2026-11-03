import type { AnyCircuitElement, PcbCopperPour, PcbPlacementError } from "circuit-json"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"

type PourId = PcbCopperPour["pcb_copper_pour_id"]
type RuntimeNetName = string
type SourceNetId = string

/** Compare electrical contacts at the same authored metal, without merging nets. */
export function compareCopperContacts(input: {
  source: AnyCircuitElement[]
  output: AnyCircuitElement[]
  sourceContacts: PcbPlacementError[]
  outputContacts: PcbPlacementError[]
  runtimeNames: ReadonlyMap<SourceNetId, RuntimeNetName>
}) {
  const originalPours=input.source.filter(e=>e.type==="pcb_copper_pour")
  const sourceMap=getFullConnectivityMapFromCircuitJson(input.source)
  const outputMap=getFullConnectivityMapFromCircuitJson(input.output)
  const allowed=new Map<PourId,Set<RuntimeNetName>>()
  const sourceNets=input.source.filter(e=>e.type==="source_net")
  const outputNets=input.output.filter(e=>e.type==="source_net")
  const pair=(error:PcbPlacementError)=>{
    const id=error.pcb_placement_error_id
    for(const pour of originalPours){
      const prefix=`copper_pour_short_${pour.pcb_copper_pour_id}_`
      const suffix=`_${pour.pcb_copper_pour_id}`
      if(id.startsWith(prefix))return {pourId:pour.pcb_copper_pour_id,otherId:id.slice(prefix.length)}
      if(id.endsWith(suffix))return {pourId:pour.pcb_copper_pour_id,otherId:id.slice("copper_pour_short_".length,-suffix.length)}
    }
  }
  for(const contact of input.sourceContacts){
    const ids=pair(contact)
    if(!ids)continue
    const key=sourceMap.getNetConnectedToId(ids.otherId)
    const names=allowed.get(ids.pourId)??new Set<RuntimeNetName>()
    for(const net of sourceNets)if(key&&sourceMap.getNetConnectedToId(net.source_net_id)===key)names.add(input.runtimeNames.get(net.source_net_id)??net.name)
    allowed.set(ids.pourId,names)
  }
  const compatible:PcbPlacementError[]=[],added:PcbPlacementError[]=[]
  for(const contact of input.outputContacts){
    const ids=pair(contact)
    const key=ids?outputMap.getNetConnectedToId(ids.otherId):undefined
    const names=ids?allowed.get(ids.pourId):undefined
    if(key&&names&&outputNets.some(net=>names.has(net.name)&&outputMap.getNetConnectedToId(net.source_net_id)===key))compatible.push(contact)
    else added.push(contact)
  }
  return {compatible,added}
}
