import type { AltiumPcbDocument } from "altiumts"
import { milsToMillimeters } from "../geometry"
import type { PcbRoutingConstraints } from "../model"
import { getHighestPriorityGlobalRule } from "./getHighestPriorityGlobalRule"
import { isAllScope } from "./isAllScope"
export function getCopperPourClearanceConstraints(
  document: AltiumPcbDocument,
): PcbRoutingConstraints["pcbBoard"] {
  const hasScopedClearance = document.rules.some(
    (rule) =>
      rule.enabled !== false &&
      rule.ruleKind?.toUpperCase() === "CLEARANCE" &&
      (!isAllScope(rule.scope1Expression) ||
        !isAllScope(rule.scope2Expression)),
  )
  if (hasScopedClearance)
    throw new Error(
      "Copper pour recomputation does not support scoped Altium clearance rules",
    )
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
