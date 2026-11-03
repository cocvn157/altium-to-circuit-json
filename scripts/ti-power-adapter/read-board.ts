import type { AltiumPcbDocument, AltiumRecord } from "altiumts"
import { AltiumPolygonRecord, AltiumFillRecord } from "altiumts"
import type { PcbCopperPour } from "circuit-json"
import { convertAltiumPcbDocToCircuitJson } from "altium-to-circuit-json"
import { convertAltiumCopperAreas } from "altium-source/pcb/copperAreas"
import { PcbCopperLayerMap } from "altium-source/pcb/layers"
import type { CopperIdentity } from "./types"
import { RuleResolver } from "./rules/RuleResolver"
import { preserveSlotDimensions } from "./preserve-slot-dimensions"

export interface PourDefinition {
  copper: PcbCopperPour
  identity: CopperIdentity
  fixed: boolean
}

export function readBoard(document: AltiumPcbDocument) {
  // The supported no-copper mode leaves the original scoped rules untouched.
  // Their interpretation belongs to this job, not to a serialized schema field.
  const circuitJson = preserveSlotDimensions(document, convertAltiumPcbDocToCircuitJson(document, {
    includeCopperAreas: false, includeTraces: false, includeVias: false, includeCadModels: false,
  }))
  const netIds = new Map(document.nets.map((net, i) => [net, `source_net_altium_pcb_${i}`]))
  const getSourceNetId = (record: AltiumRecord) => {
    const parent = document.getPolygonForRecord(record)
    const net = document.getNetForRecord(record) ?? (parent ? document.getNetForRecord(parent) : undefined)
    return net ? netIds.get(net) : undefined
  }
  const copper = convertAltiumCopperAreas(document, { copperPourMode: "recompute", getSourceNetId, layerMap: new PcbCopperLayerMap(document) })
  const definitions: PourDefinition[] = copper.map(pour => {
    const match = /^pcb_copper_pour_altium_(polygon|fill|region)_(\d+)/u.exec(pour.pcb_copper_pour_id)
    if (!match) throw new Error("Unrecognized imported copper identity")
    const record = match[1] === "polygon" ? document.polygons[Number(match[2])] : document.records[Number(match[2])]
    if (!record) throw new Error("Missing authored copper record")
    if (!(record instanceof AltiumPolygonRecord) && document.getPolygonForRecord(record)) throw new Error("Cached polygon copper leaked into recomputation")
    const component = document.getComponentForRecord(record)
    return { copper: pour, fixed: !(record instanceof AltiumPolygonRecord), identity: {
      objectType: record instanceof AltiumPolygonRecord ? "copper_pour" : "copper_region",
      matrixKind: record instanceof AltiumPolygonRecord ? "Poly" : record instanceof AltiumFillRecord ? "Fill" : "Region",
      layer: pour.layer, netName: document.getNetForRecord(record)?.name,
      componentName: component?.designator, isFree: !component,
    } }
  })
  return { circuitJson, definitions, rules: new RuleResolver(document) }
}
