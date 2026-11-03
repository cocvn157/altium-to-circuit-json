import type { AltiumPcbDocument } from "altiumts"
import { milsToMillimeters } from "../geometry"
import type { AltiumClearanceObject } from "./AltiumClearanceQuery"
import { matchesAltiumClearanceQuery } from "./matchesAltiumClearanceQuery"
import { parseAltiumClearanceQuery } from "./parseAltiumClearanceQuery"

/** Resolve polygon edge rules in priority order; lower rules cannot override a match. */
export function getAltiumCopperBoardEdgeMargin(
  document: AltiumPcbDocument,
  source: AltiumClearanceObject,
): number {
  const rules = document.rules
    .filter(
      (rule) =>
        rule.enabled !== false &&
        rule.ruleKind?.toUpperCase() === "BOARDOUTLINECLEARANCE",
    )
    .sort(
      (first, second) =>
        (first.priority ?? Number.MAX_SAFE_INTEGER) -
        (second.priority ?? Number.MAX_SAFE_INTEGER),
    )
  for (const rule of rules) {
    if (
      !matchesAltiumClearanceQuery(
        parseAltiumClearanceQuery(rule.scope1Expression),
        source,
      )
    )
      continue
    const gap = rule.clearanceMils
    if (gap === undefined || !Number.isFinite(gap) || gap < 0)
      throw new Error(
        "Board outline clearance requires a finite, nonnegative gap",
      )
    return milsToMillimeters(gap)
  }
  return 0
}
