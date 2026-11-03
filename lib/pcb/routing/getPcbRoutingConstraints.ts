import { type AltiumPcbDocument, AltiumViaRecord } from "altiumts"
import { milsToMillimeters } from "../geometry"
import type { PcbCopperLayerMap } from "../layers"
import type { PcbRoutingConstraints } from "../model"
import { getHighestPriorityGlobalRule } from "./getHighestPriorityGlobalRule"
import { getCopperPourClearanceConstraints } from "./getCopperPourClearanceConstraints"
import { usesViaInPad } from "./usesViaInPad"

export function getPcbRoutingConstraints({
  document,
  layerMap,
  copperPourMode,
}: {
  document: AltiumPcbDocument
  layerMap: PcbCopperLayerMap
  copperPourMode?: "preserve" | "recompute"
}): PcbRoutingConstraints {
  const widthRule = getHighestPriorityGlobalRule({
    document,
    ruleKind: "Width",
  })
  const routingViasRule = getHighestPriorityGlobalRule({
    document,
    ruleKind: "RoutingVias",
  })
  const minimumTraceWidthMils = widthRule?.widthConstraint?.minimumMils
  const preferredTraceWidthMils = widthRule?.widthConstraint?.preferredMils
  const minimumViaHoleDiameterMils =
    routingViasRule?.viaHoleConstraint?.minimumMils
  const minimumViaPadDiameterMils =
    routingViasRule?.viaDiameterConstraint?.minimumMils
  const pcbBoard: PcbRoutingConstraints["pcbBoard"] =
    copperPourMode === "recompute" && document.polygons.length > 0
      ? getCopperPourClearanceConstraints(document)
      : {}
  const routingConstraints: PcbRoutingConstraints = { pcbBoard }

  const hasBlindOrBuriedVia = document.records.some(
    (record) =>
      record instanceof AltiumViaRecord && record.kind === "blind-buried",
  )
  if (hasBlindOrBuriedVia) {
    pcbBoard.allow_blind_and_buried_vias = true
  }

  if (usesViaInPad({ document, layerMap })) {
    pcbBoard.is_via_in_pad_allowed = true
  }

  if (minimumTraceWidthMils !== undefined) {
    pcbBoard.min_trace_width = milsToMillimeters(minimumTraceWidthMils)
  }

  if (minimumViaHoleDiameterMils !== undefined) {
    pcbBoard.min_via_hole_diameter = milsToMillimeters(
      minimumViaHoleDiameterMils,
    )
  }

  if (minimumViaPadDiameterMils !== undefined) {
    pcbBoard.min_via_pad_diameter = milsToMillimeters(minimumViaPadDiameterMils)
  }

  if (preferredTraceWidthMils !== undefined) {
    routingConstraints.sourceNetTraceWidthMillimeters = milsToMillimeters(
      preferredTraceWidthMils,
    )
  }

  return routingConstraints
}
