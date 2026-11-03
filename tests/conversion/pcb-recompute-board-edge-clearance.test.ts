import { expect, test } from "bun:test"
import { parseAltiumPcbDoc } from "altiumts"
import { convertAltiumPcbDocToCircuitJson } from "../../lib"
import { copperPourDefinitionRecords } from "../fixtures/copper-pour-definition"

test("imports board edge clearance and rejects a negative margin", () => {
  const document = parseAltiumPcbDoc(
    [
      ...copperPourDefinitionRecords,
      "|RECORD=Rule|RULEKIND=BoardOutlineClearance|ENABLED=TRUE|SCOPE1EXPRESSION=All|SCOPE2EXPRESSION=All|GAP=5mil",
    ].join("\n"),
  )
  expect(
    convertAltiumPcbDocToCircuitJson(document, {
      copperPourMode: "recompute",
    }).find((element) => element.type === "pcb_board"),
  ).toMatchObject({
    min_board_edge_clearance: 0.127,
    min_via_edge_to_pad_edge_clearance: 0.254,
  })

  const invalid = parseAltiumPcbDoc(
    [
      ...copperPourDefinitionRecords,
      "|RECORD=Rule|RULEKIND=BoardOutlineClearance|ENABLED=TRUE|SCOPE1EXPRESSION=All|SCOPE2EXPRESSION=All|GAP=-5mil",
    ].join("\n"),
  )
  expect(() =>
    convertAltiumPcbDocToCircuitJson(invalid, { copperPourMode: "recompute" }),
  ).toThrow("board edge clearance must be finite and nonnegative")
})
