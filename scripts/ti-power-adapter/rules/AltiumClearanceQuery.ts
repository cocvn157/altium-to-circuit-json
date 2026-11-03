import type { LayerRef } from "circuit-json"
import type { CopperObjectType } from "../types"
import type { PcbCopperLayerMap } from "altium-source/pcb/layers"

export type AltiumClearanceQuery =
  | { kind: "keyword"; name: string }
  | { kind: "call"; name: string; argument: string }
  | { kind: "not"; query: AltiumClearanceQuery }
  | { kind: "and"; left: AltiumClearanceQuery; right: AltiumClearanceQuery }
  | { kind: "or"; left: AltiumClearanceQuery; right: AltiumClearanceQuery }

export interface AltiumClearanceObject {
  objectType: CopperObjectType
  layer: LayerRef
  netName?: string
  netClasses: ReadonlySet<string>
  componentClasses?: ReadonlySet<string>
  isFree: boolean
  layerMap: PcbCopperLayerMap
}
