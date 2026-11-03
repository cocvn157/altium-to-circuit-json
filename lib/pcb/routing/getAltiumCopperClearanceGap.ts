import type { AltiumClearanceObject } from "./AltiumClearanceQuery"
import { matchesAltiumClearanceQuery } from "./matchesAltiumClearanceQuery"
import type { CopperPourClearanceObjectType } from "circuit-json"
import { milsToMillimeters } from "../geometry"
import type {
  AltiumCopperClearanceRule,
  ApplicableAltiumCopperClearanceRule,
  AltiumCopperMatrixKind,
} from "./AltiumCopperClearanceRule"

const matrixKinds: Record<
  CopperPourClearanceObjectType,
  AltiumCopperMatrixKind[]
> = {
  smtpad: ["SMDPad"],
  plated_hole: ["THPad"],
  via: ["Via"],
  trace: ["Track"],
  copper_pour: ["Poly"],
  copper_region: ["Fill", "Region"],
  hole: ["Hole"],
}

export function getAltiumCopperClearanceGap({
  rule,
  sourceKind,
  targetType,
}: {
  rule: AltiumCopperClearanceRule
  sourceKind: AltiumCopperMatrixKind
  targetType: CopperPourClearanceObjectType
}): number {
  const gaps = matrixKinds[targetType].map((targetKind) => {
    const matrixEntry = rule.matrix.find(
      (entry) =>
        (entry.first === sourceKind && entry.second === targetKind) ||
        (entry.second === sourceKind && entry.first === targetKind),
    )
    const gap = matrixEntry?.clearanceMils ?? rule.record.clearanceMils
    if (gap === undefined || !Number.isFinite(gap) || gap < 0)
      throw new Error(
        `Clearance rule ${rule.record.name ?? "unnamed rule"} requires a finite, nonnegative gap`,
      )
    return milsToMillimeters(gap)
  })
  if (gaps.some((gap) => gap !== gaps[0]))
    throw new Error(
      "Cannot preserve different Fill and Region clearances for the same copper target",
    )
  return gaps[0]!
}

export function resolveAltiumCopperClearanceGap({
  rules,
  sourceKind,
  target,
}: {
  rules: ApplicableAltiumCopperClearanceRule[]
  sourceKind: AltiumCopperMatrixKind
  target: AltiumClearanceObject
}): number {
  const matching = rules.find(({ target: query }) =>
    matchesAltiumClearanceQuery(query, target),
  )
  if (!matching)
    throw new Error("No applicable Altium copper clearance rule was found")
  return getAltiumCopperClearanceGap({
    rule: matching.rule,
    sourceKind,
    targetType: target.objectType,
  })
}
