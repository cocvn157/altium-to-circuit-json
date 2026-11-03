import type { LayerRef } from "circuit-json"

export type CopperObjectType =
  | "smtpad" | "plated_hole" | "via" | "trace"
  | "copper_pour" | "copper_region" | "hole"

export interface CopperIdentity {
  objectType: CopperObjectType
  matrixKind: "SMDPad" | "THPad" | "Via" | "Track" | "Poly" | "Fill" | "Region" | "Hole"
  layer: LayerRef
  netName?: string
  componentName?: string
  isFree: boolean
}
