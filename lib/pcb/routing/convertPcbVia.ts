import type { AltiumViaRecord } from "altiumts"
import type { PcbVia } from "circuit-json"
import { milsToMillimeters, toMillimeterPoint } from "../geometry"
import type { PcbCopperLayerMap } from "../layers"
import type { PcbNetContext } from "../model"

export function convertPcbVia({
  layerMap,
  record,
  recordIndex,
  netContext,
}: {
  layerMap: PcbCopperLayerMap
  record: AltiumViaRecord
  recordIndex: number
  netContext: PcbNetContext
}): PcbVia | undefined {
  if (!record.position) return undefined
  const startLayer = layerMap.getLayer(record.startLayer ?? "TOP")
  const endLayer = layerMap.getLayer(record.endLayer ?? "BOTTOM")
  if (!startLayer || !endLayer) {
    throw new Error(
      `Invalid via copper layer span: ${record.startLayer} → ${record.endLayer}`,
    )
  }
  const layers = startLayer === endLayer ? [startLayer] : [startLayer, endLayer]
  const outerDiameter = milsToMillimeters(record.diameterMils ?? 20)
  const sourceNetId = netContext.getSourceNetId(record)
  const sourceTraceId = netContext.getSourceTraceId(record)
  return {
    type: "pcb_via",
    pcb_via_id: `pcb_via_altium_${recordIndex}`,
    ...(sourceNetId ? { source_net_id: sourceNetId } : {}),
    ...(sourceTraceId ? { source_trace_id: sourceTraceId } : {}),
    ...toMillimeterPoint(record.position),
    outer_diameter: outerDiameter,
    hole_diameter: milsToMillimeters(
      record.holeSizeMils ?? (record.diameterMils ?? 20) * 0.45,
    ),
    layers,
    tented_on_top: record.tentedTop === true,
    tented_on_bottom: record.tentedBottom === true,
  }
}
