import type { AltiumPcbDocument } from "altiumts"
import type { AltiumCopperClearanceRule } from "./AltiumCopperClearanceRule"
import { parseAltiumClearanceQuery } from "./parseAltiumClearanceQuery"

export function getAltiumCopperClearanceRules(
  document: AltiumPcbDocument,
): AltiumCopperClearanceRule[] {
  return document.rules
    .filter(
      (rule) =>
        rule.enabled !== false && rule.ruleKind?.toUpperCase() === "CLEARANCE",
    )
    .sort(
      (first, second) =>
        (first.priority ?? Number.MAX_SAFE_INTEGER) -
        (second.priority ?? Number.MAX_SAFE_INTEGER),
    )
    .map((record) => ({
      record,
      first: parseAltiumClearanceQuery(record.scope1Expression),
      second: parseAltiumClearanceQuery(record.scope2Expression),
      matrix: (record.get("OBJECTCLEARANCES") || "")
        .split(";")
        .filter(Boolean)
        .map((entry) => {
          const match =
            /^ClearanceObj_(\w+)-ClearanceObj_(\w+):([\d.eE+-]+)$/u.exec(entry)
          const internalUnits = Number(match?.[3])
          if (!match || !Number.isFinite(internalUnits) || internalUnits < 0)
            throw new Error(
              `Unsupported clearance matrix in rule ${record.name ?? "unnamed rule"}`,
            )
          // Altium binary PCB coordinates and object-clearance matrices use 10000 units/mil.
          return {
            first: match[1]!,
            second: match[2]!,
            clearanceMils: internalUnits / 10000,
          }
        }),
    }))
}
