import type { AltiumClearanceObject } from "./AltiumClearanceQuery"
import type {
  AltiumCopperClearanceRule,
  ApplicableAltiumCopperClearanceRule,
} from "./AltiumCopperClearanceRule"
import {
  assertRepresentableClearanceTarget,
  matchesAltiumClearanceQuery,
} from "./matchesAltiumClearanceQuery"

export function getApplicableAltiumCopperRules(
  rules: AltiumCopperClearanceRule[],
  source: AltiumClearanceObject,
): ApplicableAltiumCopperClearanceRule[] {
  return rules.flatMap((rule) => {
    const targets = [
      ...(matchesAltiumClearanceQuery(rule.first, source) ? [rule.second] : []),
      ...(matchesAltiumClearanceQuery(rule.second, source) ? [rule.first] : []),
    ]
    if (targets.length === 0) return []
    const netScope = rule.record.get("NETSCOPE")
    if (netScope && netScope.toUpperCase() !== "DIFFERENTNETS")
      throw new Error(
        "Copper recomputation currently requires DifferentNets clearance rules",
      )
    const layerKind = rule.record.get("LAYERKIND")
    if (layerKind && layerKind.toUpperCase() !== "SAMELAYER")
      throw new Error(
        "Copper recomputation currently requires SameLayer clearance rules",
      )
    return targets.map((target) => {
      assertRepresentableClearanceTarget(target)
      return { rule, target }
    })
  })
}
