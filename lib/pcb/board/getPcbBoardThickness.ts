import { type AltiumPcbDocument, getPcbLayerStack } from "altiumts"
import { milsToMillimeters } from "../geometry"
import { getOrderedCopperStackEntries } from "../layers/getOrderedCopperStackEntries"

const DEFAULT_BOARD_THICKNESS_MM = 1.6

export function getPcbBoardThickness(document: AltiumPcbDocument): number {
  if (!document.board) return DEFAULT_BOARD_THICKNESS_MM
  const entries = getPcbLayerStack(document.board).entries
  const v8Entries = entries.filter((entry) => entry.source === "v8")
  const preferredEntries =
    v8Entries.length > 0 ? v8Entries : getOrderedCopperStackEntries(document)
  const thicknessMils = preferredEntries.reduce(
    (total, entry) =>
      total +
      (entry.copperThickness?.toMils() ?? 0) +
      (entry.dielectricHeight?.toMils() ?? 0),
    0,
  )

  return thicknessMils > 0
    ? milsToMillimeters(thicknessMils)
    : DEFAULT_BOARD_THICKNESS_MM
}
