import type { AltiumPadRecord, getAltiumPcbPadGeometry } from "altiumts"
import type { LayerRef, PcbPlatedHole } from "circuit-json"
import type { PcbCopperLayerMap } from "../layers"

export type PcbPadStackLayer =
  | {
      layer: LayerRef
      shape: "circle"
      radius: number
    }
  | {
      layer: LayerRef
      shape: "pill"
      width: number
      height: number
      radius: number
      ccw_rotation?: number
    }
  | {
      layer: LayerRef
      shape: "rect"
      width: number
      height: number
      ccw_rotation?: number
      corner_radius?: number
    }
  | {
      layer: LayerRef
      shape: "polygon"
      points: Array<{ x: number; y: number }>
    }

export type PcbPadStack = PcbPadStackLayer[]

export type PcbPlatedHoleWithPadStack = PcbPlatedHole & {
  pad_stack?: PcbPadStack
}

export interface ThroughHolePadConversionOptions {
  cornerRadius: number | undefined
  geometry: ReturnType<typeof getAltiumPcbPadGeometry>
  height: number
  holeDiameter: number
  id: string
  layerMap?: PcbCopperLayerMap
  record: AltiumPadRecord
  shape: string
  width: number
  x: number
  y: number
}
