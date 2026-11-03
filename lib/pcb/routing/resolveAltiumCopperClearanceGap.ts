import type { AltiumClearanceObject } from "./AltiumClearanceQuery"
import { matchesAltiumClearanceQuery } from "./matchesAltiumClearanceQuery"
import type {
  ApplicableAltiumCopperClearanceRule,
  AltiumCopperMatrixKind,
} from "./AltiumCopperClearanceRule"
import { getAltiumCopperClearanceGap } from "./getAltiumCopperClearanceGap"

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
