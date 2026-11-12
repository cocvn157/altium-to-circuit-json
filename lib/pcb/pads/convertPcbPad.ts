import {
  type AltiumPadRecord,
  getAltiumPcbPadGeometry,
  normalizeAltiumAngle,
} from "altiumts"
import type { PcbHole, PcbPlatedHole, PcbSmtPad } from "circuit-json"
import { createOctagonPoints, milsToMillimeters } from "../geometry"
import { normalizeLayer, type PcbCopperLayerMap } from "../layers"
import { convertThroughHolePad } from "./convertThroughHolePad"
import { isSlottedThroughHolePad } from "./isSlottedThroughHolePad"
import { normalizeShape } from "./normalizeShape"

export function convertPcbPad({
  layerMap,
  record,
  recordIndex,
}: {
  layerMap: PcbCopperLayerMap
  record: AltiumPadRecord
  recordIndex: number
}): PcbSmtPad | PcbPlatedHole | PcbHole | undefined {
  const position = record.position
  if (!position) return undefined
  const layer = layerMap.getLayer(record.layer)
  if (!layer && normalizeLayer(record.layer) !== "MULTILAYER") return undefined
  const geometry = getAltiumPcbPadGeometry({
    record,
    useRequestedLayerGeometry: true,
  })
  const x = milsToMillimeters(position.x)
  const y = milsToMillimeters(position.y)
  const width = milsToMillimeters(geometry.widthMils)
  const height = milsToMillimeters(geometry.heightMils)
  const cornerRadius =
    geometry.cornerRadiusMils === 0
      ? undefined
      : milsToMillimeters(geometry.cornerRadiusMils)
  const holeDiameter = milsToMillimeters(geometry.holeSizeMils)
  const shape = normalizeShape(geometry.shape)
  const id = `altium_${recordIndex}`
  const soldermaskMargin =
    record.solderMaskExpansionMils === undefined
      ? undefined
      : milsToMillimeters(record.solderMaskExpansionMils)
  const isCoveredWithSolderMask =
    soldermaskMargin !== undefined &&
    (width + 2 * soldermaskMargin <= 0 || height + 2 * soldermaskMargin <= 0)

  if (!geometry.plated && holeDiameter > 0) {
    if (isSlottedThroughHolePad({ geometry, record })) {
      const holeWidth = milsToMillimeters(
        Math.max(geometry.slotLengthMils, geometry.holeSizeMils),
      )
      const ccwRotation = normalizeAltiumAngle(
        geometry.ccwRotationDegrees + geometry.holeCcwRotationDegrees,
      )
      const slot = {
        type: "pcb_hole" as const,
        pcb_hole_id: `pcb_hole_${id}`,
        hole_width: holeWidth,
        hole_height: holeDiameter,
        x,
        y,
      }
      return ccwRotation === 0
        ? { ...slot, hole_shape: "pill" }
        : {
            ...slot,
            hole_shape: "rotated_pill",
            ccw_rotation: ccwRotation,
          }
    }
    return {
      type: "pcb_hole",
      pcb_hole_id: `pcb_hole_${id}`,
      hole_shape: "circle",
      hole_diameter: holeDiameter,
      x,
      y,
    }
  }

  if (record.behavior === "through-hole" || holeDiameter > 0) {
    return convertThroughHolePad({
      cornerRadius,
      geometry,
      height,
      holeDiameter,
      id,
      layerMap,
      record,
      shape,
      width,
      x,
      y,
    })
  }

  if (!layer) return undefined
  const base = {
    type: "pcb_smtpad" as const,
    pcb_smtpad_id: `pcb_smtpad_${id}`,
    x,
    y,
    layer,
    ...(isCoveredWithSolderMask
      ? { is_covered_with_solder_mask: true }
      : { soldermask_margin: soldermaskMargin }),
  }

  if (shape.includes("OCTAGON")) {
    return {
      ...base,
      shape: "polygon",
      points: createOctagonPoints({
        x,
        y,
        width,
        height,
        ccwRotationDegrees: geometry.ccwRotationDegrees,
      }),
    }
  }
  if (shape === "ROUND" || shape === "CIRCLE" || shape === "OVAL") {
    if (Math.abs(width - height) < 0.0001) {
      return { ...base, shape: "circle", radius: width / 2 }
    }
    return geometry.ccwRotationDegrees === 0
      ? {
          ...base,
          shape: "pill",
          width,
          height,
          radius: Math.min(width, height) / 2,
        }
      : {
          ...base,
          shape: "rotated_pill",
          width,
          height,
          radius: Math.min(width, height) / 2,
          ccw_rotation: geometry.ccwRotationDegrees,
        }
  }

  return geometry.ccwRotationDegrees === 0
    ? { ...base, shape: "rect", width, height, corner_radius: cornerRadius }
    : {
        ...base,
        shape: "rotated_rect",
        width,
        height,
        corner_radius: cornerRadius,
        ccw_rotation: geometry.ccwRotationDegrees,
      }
}
