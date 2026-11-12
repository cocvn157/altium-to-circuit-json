import { getAltiumPcbPadGeometry } from "altiumts"
import { createOctagonPoints, milsToMillimeters } from "../geometry"
import type { PcbCopperLayerMap } from "../layers"
import { isRectangularShape } from "./isRectangularShape"
import { normalizeShape } from "./normalizeShape"
import type { PcbPadStack, ThroughHolePadConversionOptions } from "./types"

export function createPcbPadStack({
  layerMap,
  record,
}: {
  layerMap: PcbCopperLayerMap
  record: ThroughHolePadConversionOptions["record"]
}): PcbPadStack {
  return layerMap.layers.map((layer) => {
    const geometry = getAltiumPcbPadGeometry({
      record,
      requestedLayers: [layerMap.getAltiumPadStackLayer(layer)],
      useRequestedLayerGeometry: true,
    })
    const shape = normalizeShape(geometry.shape)
    const width = milsToMillimeters(geometry.widthMils)
    const height = milsToMillimeters(geometry.heightMils)
    const ccwRotation =
      geometry.ccwRotationDegrees === 0
        ? undefined
        : geometry.ccwRotationDegrees
    const cornerRadius =
      geometry.cornerRadiusMils === 0
        ? undefined
        : milsToMillimeters(geometry.cornerRadiusMils)

    if (shape.includes("OCTAGON")) {
      return {
        layer,
        shape: "polygon" as const,
        points: createOctagonPoints({
          x: 0,
          y: 0,
          width,
          height,
          ccwRotationDegrees: geometry.ccwRotationDegrees,
        }),
      }
    }
    if (
      (shape === "ROUND" || shape === "CIRCLE" || shape === "OVAL") &&
      Math.abs(width - height) < 0.0001
    ) {
      return { layer, shape: "circle" as const, radius: width / 2 }
    }
    if (shape === "ROUND" || shape === "CIRCLE" || shape === "OVAL") {
      return {
        layer,
        shape: "pill" as const,
        width,
        height,
        radius: Math.min(width, height) / 2,
        ...(ccwRotation === undefined ? {} : { ccw_rotation: ccwRotation }),
      }
    }
    if (isRectangularShape(shape)) {
      return {
        layer,
        shape: "rect" as const,
        width,
        height,
        ...(ccwRotation === undefined ? {} : { ccw_rotation: ccwRotation }),
        ...(cornerRadius === undefined ? {} : { corner_radius: cornerRadius }),
      }
    }
    return {
      layer,
      shape: "rect" as const,
      width,
      height,
      ...(ccwRotation === undefined ? {} : { ccw_rotation: ccwRotation }),
    }
  })
}
