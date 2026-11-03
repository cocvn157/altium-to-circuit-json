import type { AnyCircuitElement, SourceNet, SourcePort, PcbPortNotConnectedError } from "circuit-json"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"

type SourceNetId = SourceNet["source_net_id"]
type SourcePortId = SourcePort["source_port_id"]

/** A net with one authored terminal has no interconnect for an autorouter to add. */
export function getSingletonPortDiagnostics(input: {
  source: AnyCircuitElement[]
  output: AnyCircuitElement[]
  errors: {type:string;message:string}[]
  runtimeNames: ReadonlyMap<SourceNetId,string>
}): PcbPortNotConnectedError[] {
  const ports=new Map<SourceNetId,Set<SourcePortId>>()
  for(const element of input.source)if(element.type==="source_trace")for(const netId of element.connected_source_net_ids){
    const ids=ports.get(netId)??new Set<SourcePortId>()
    for(const id of element.connected_source_port_ids)ids.add(id)
    ports.set(netId,ids)
  }
  const names=new Set(input.source.filter((e):e is SourceNet=>e.type==="source_net").filter(net=>ports.get(net.source_net_id)?.size===1).map(net=>input.runtimeNames.get(net.source_net_id)??net.name))
  const connectivity=getFullConnectivityMapFromCircuitJson(input.output)
  const keys=new Set(input.output.filter((e):e is SourceNet=>e.type==="source_net").filter(net=>names.has(net.name)).map(net=>connectivity.getNetConnectedToId(net.source_net_id)).filter(Boolean))
  return input.errors.filter((error):error is PcbPortNotConnectedError=>error.type==="pcb_port_not_connected_error")
    .filter(error=>error.pcb_port_ids.length>0&&error.pcb_port_ids.every(id=>keys.has(connectivity.getNetConnectedToId(id))))
}
