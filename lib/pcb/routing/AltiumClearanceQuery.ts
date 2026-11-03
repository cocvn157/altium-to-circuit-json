import type { CopperPourClearanceObjectType, LayerRef } from "circuit-json"
import type { PcbCopperLayerMap } from "../layers"

export type AltiumClearanceQuery =
  | { kind: "keyword"; name: string }
  | { kind: "call"; name: string; argument: string }
  | { kind: "not"; query: AltiumClearanceQuery }
  | { kind: "and"; left: AltiumClearanceQuery; right: AltiumClearanceQuery }
  | { kind: "or"; left: AltiumClearanceQuery; right: AltiumClearanceQuery }

export interface AltiumClearanceObject {
  objectType: CopperPourClearanceObjectType
  layer: LayerRef
  netName?: string
  netClasses: ReadonlySet<string>
  componentClasses?: ReadonlySet<string>
  isFree: boolean
  layerMap: PcbCopperLayerMap
}
