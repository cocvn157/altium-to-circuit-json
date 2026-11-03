import type { AnyCircuitElement, PcbPadPadClearanceError } from "circuit-json"
import { getElementId } from "@tscircuit/circuit-json-util"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"

export function getNativeViaDiagnostics(json: AnyCircuitElement[], errors: {type:string}[]) {
  const map=getFullConnectivityMapFromCircuitJson(json)
  const elements=new Map(json.map(e=>[getElementId(e),e]))
  const nets=json.filter(e=>e.type==="source_net")
  const names=(id:string)=>nets.filter(net=>map.areIdsConnected(id,net.source_net_id)).map(net=>net.name)
  return errors.filter((e):e is PcbPadPadClearanceError=>e.type==="pcb_pad_pad_clearance_error").flatMap(error=>{
    if(!error.pcb_pad_pad_clearance_error_id.startsWith("via_pad_clearance_"))return []
    const pair=error.pcb_pad_ids.map(id=>elements.get(id)),via=pair.find(e=>e?.type==="pcb_via"),pad=pair.find(e=>e?.type==="pcb_smtpad"||e?.type==="pcb_plated_hole")
    if(via?.type!=="pcb_via"||!pad)return []
    const adjacent=json.filter(e=>e.type==="pcb_trace"&&e.route.some(p=>p.route_type==="wire"&&Math.hypot(p.x-via.x,p.y-via.y)<1e-7))
    const reference=via.pcb_trace_id?elements.get(via.pcb_trace_id):undefined
    return [{message:error.message,viaNetNames:names(via.pcb_via_id),padNetNames:names(getElementId(pad)),adjacentTraceNetNames:adjacent.map(e=>e.type==="pcb_trace"?names(e.pcb_trace_id):[]),referencedTraceExists:reference?.type==="pcb_trace",referenceTraceNetNames:reference?.type==="pcb_trace"?names(reference.pcb_trace_id):[],viaConnectivityKey:via.subcircuit_connectivity_map_key,viaDiameter:via.outer_diameter,viaHole:via.hole_diameter,viaLayers:via.layers,padShape:"shape" in pad?pad.shape:undefined,padLayers:"layer" in pad?[pad.layer]:"layers" in pad?pad.layers:[],actualGap:error.actual_clearance}]
  })
}
