import { normalizeAltiumAngle } from "altiumts"
import type { LayerRef } from "circuit-json"
import { milsToMillimeters } from "../geometry"
import { createPcbPadStack } from "./createPcbPadStack"
import { getRotatedHoleOffset } from "./getRotatedHoleOffset"
import { isRectangularShape } from "./isRectangularShape"
import type {
  PcbPlatedHoleWithPadStack,
  ThroughHolePadConversionOptions,
} from "./types"

export function convertSlottedThroughHolePad({
  cornerRadius,
  geometry,
  height,
  id,
  layerMap,
  record,
  shape,
  width,
  x,
  y,
}: ThroughHolePadConversionOptions): PcbPlatedHoleWithPadStack {
  const holeOffset = getRotatedHoleOffset(geometry)
  const holeCcwRotationDegrees = normalizeAltiumAngle(
    geometry.ccwRotationDegrees + geometry.holeCcwRotationDegrees,
  )
  const holeHeight = milsToMillimeters(Math.max(geometry.holeSizeMils, 1))
  const holeWidth = milsToMillimeters(
    Math.max(geometry.slotLengthMils, geometry.holeSizeMils, 1),
  )
  const layers: LayerRef[] = layerMap?.layers ?? ["top", "bottom"]
  const pad_stack = layerMap
    ? createPcbPadStack({ layerMap, record })
    : undefined
  const padStackField = pad_stack ? { pad_stack } : {}

  const isRectangularPad = isRectangularShape(shape)
  const isAlignedCenteredSlot =
    normalizeAltiumAngle(
      holeCcwRotationDegrees - geometry.ccwRotationDegrees,
    ) === 0 &&
    holeOffset.x === 0 &&
    holeOffset.y === 0

  if (!isRectangularPad && isAlignedCenteredSlot) {
    return {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: `pcb_plated_hole_${id}`,
      shape: "pill",
      outer_width: width,
      outer_height: height,
      hole_width: holeWidth,
      hole_height: holeHeight,
      ccw_rotation: holeCcwRotationDegrees,
      x,
      y,
      layers,
      ...padStackField,
    }
  }

  // Non-rectangular pads retain the existing oval approximation.
  const rectBorderRadius = isRectangularPad
    ? cornerRadius
    : Math.min(width, height) / 2
  const isRotated =
    holeCcwRotationDegrees !== 0 || geometry.ccwRotationDegrees !== 0
  if (isRotated) {
    return {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: `pcb_plated_hole_${id}`,
      shape: "rotated_pill_hole_with_rect_pad",
      hole_shape: "rotated_pill",
      pad_shape: "rect",
      hole_width: holeWidth,
      hole_height: holeHeight,
      hole_ccw_rotation: holeCcwRotationDegrees,
      rect_pad_width: width,
      rect_pad_height: height,
      rect_border_radius: rectBorderRadius,
      rect_ccw_rotation: geometry.ccwRotationDegrees,
      hole_offset_x: milsToMillimeters(holeOffset.x),
      hole_offset_y: milsToMillimeters(holeOffset.y),
      x,
      y,
      layers,
      ...padStackField,
    }
  }

  return {
    type: "pcb_plated_hole",
    pcb_plated_hole_id: `pcb_plated_hole_${id}`,
    shape: "pill_hole_with_rect_pad",
    hole_shape: "pill",
    pad_shape: "rect",
    hole_width: holeWidth,
    hole_height: holeHeight,
    rect_pad_width: width,
    rect_pad_height: height,
    rect_border_radius: rectBorderRadius,
    hole_offset_x: milsToMillimeters(holeOffset.x),
    hole_offset_y: milsToMillimeters(holeOffset.y),
    x,
    y,
    layers,
    ...padStackField,
  }
}
