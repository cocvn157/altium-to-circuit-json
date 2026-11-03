import type { AltiumRuleRecord } from "altiumts"
import type { AltiumClearanceQuery } from "./AltiumClearanceQuery"

export type AltiumCopperMatrixKind =
  | "Poly"
  | "Region"
  | "Fill"
  | "Track"
  | "SMDPad"
  | "THPad"
  | "Via"
  | "Hole"

export interface AltiumCopperClearanceRule {
  record: AltiumRuleRecord
  first: AltiumClearanceQuery
  second: AltiumClearanceQuery
  matrix: Array<{ first: string; second: string; clearanceMils: number }>
}

export interface ApplicableAltiumCopperClearanceRule {
  rule: AltiumCopperClearanceRule
  target: AltiumClearanceQuery
}
