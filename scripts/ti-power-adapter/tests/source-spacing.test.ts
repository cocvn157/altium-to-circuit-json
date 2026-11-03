import { expect, test } from "bun:test"
import type { PcbPadPadClearanceError } from "circuit-json"
import { isExistingPadSpacing } from "../is-existing-pad-spacing"

test("source pad spacing attribution cannot excuse a worse gap or a different location", () => {
  const original: PcbPadPadClearanceError = { type: "pcb_pad_pad_clearance_error", pcb_pad_pad_clearance_error_id: "source", pcb_pad_ids: ["a", "b"], error_type: "pcb_pad_pad_clearance_error", message: "source labels", center: { x: 1, y: 2 }, actual_clearance: .05, minimum_clearance: .1 }
  expect(isExistingPadSpacing([original], { ...original, message: "runtime labels", pcb_pad_pad_clearance_error_id: "output" })).toBe(true)
  expect(isExistingPadSpacing([original], { ...original, actual_clearance: .03 })).toBe(false)
  expect(isExistingPadSpacing([original], { ...original, center: { x: 3, y: 2 } })).toBe(false)
  expect(isExistingPadSpacing([original], { ...original, center: undefined })).toBe(false)
})
