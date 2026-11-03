import type { AltiumPcbDocument } from "altiumts"
import { milsToMillimeters } from "../geometry"
import type { PcbRoutingConstraints } from "../model"
import { getHighestPriorityGlobalRule } from "./getHighestPriorityGlobalRule"
export function getCopperPourClearanceConstraints(
  document: AltiumPcbDocument,
): PcbRoutingConstraints["pcbBoard"] {
  const clearanceMils = getHighestPriorityGlobalRule({
    document,
    ruleKind: "Clearance",
  })?.clearanceMils
  if (clearanceMils === undefined)
    throw new Error(
      "Copper pour recomputation requires a global Altium clearance rule",
    )
  if (!Number.isFinite(clearanceMils) || clearanceMils < 0)
    throw new Error(
      "Altium copper pour clearance must be finite and nonnegative",
    )
  const boardEdgeClearanceMils = getHighestPriorityGlobalRule({
    document,
    ruleKind: "BoardOutlineClearance",
  })?.clearanceMils
  if (
    boardEdgeClearanceMils !== undefined &&
    (!Number.isFinite(boardEdgeClearanceMils) || boardEdgeClearanceMils < 0)
  ) {
    throw new Error(
      "Altium board edge clearance must be finite and nonnegative",
    )
  }
  const clearanceMillimeters = milsToMillimeters(clearanceMils)
  return {
    ...(boardEdgeClearanceMils === undefined
      ? {}
      : {
          min_board_edge_clearance: milsToMillimeters(boardEdgeClearanceMils),
        }),
    min_trace_to_pad_edge_clearance: clearanceMillimeters,
    min_different_net_trace_edge_to_trace_edge_clearance: clearanceMillimeters,
    min_pad_edge_to_pad_edge_clearance: clearanceMillimeters,
    min_via_edge_to_pad_edge_clearance: clearanceMillimeters,
  }
}
