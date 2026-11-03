import type { PcbPadPadClearanceError } from "circuit-json"

/** Runtime IDs and labels change during TSX rendering; compare physical findings. */
export function isExistingPadSpacing(before: PcbPadPadClearanceError[], after: PcbPadPadClearanceError) {
  const { x, y } = after.center ?? {}
  const { actual_clearance: actual, minimum_clearance: minimum } = after
  if (x === undefined || y === undefined || actual === undefined || minimum === undefined) return false
  return before.some(original => {
    const { x: originalX, y: originalY } = original.center ?? {}
    const { actual_clearance: oldActual, minimum_clearance: oldMinimum } = original
    return originalX !== undefined && originalY !== undefined && oldActual !== undefined && oldMinimum !== undefined
      && Math.hypot(originalX - x, originalY - y) < 1e-6
      && actual >= oldActual - 1e-6 && minimum <= oldMinimum + 1e-6
  })
}
