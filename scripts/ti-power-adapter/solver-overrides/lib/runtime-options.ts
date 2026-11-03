import type { InputPad } from "./types"

/** Runtime policy for the import job; never serialized into Circuit JSON. */
export interface CopperPourRuntimeOptions {
  fixedRegions?: ReadonlySet<number>
  padClearance?: (input: { regionIndex: number; pad: InputPad }) => number | undefined
  pourClearance?: (input: { regionIndex: number; otherRegionIndex: number }) => number
}
