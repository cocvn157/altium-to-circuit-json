import { expect, test } from "bun:test"
import { parseAltiumPcbDoc } from "altiumts"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { stackSvgsHorizontally } from "stack-svgs"
import { convertAltiumPcbDocToCircuitJson } from "../../lib"
import { copperPourDefinitionRecords } from "../fixtures/copper-pour-definition"
test("shows cached fill gaps that are not part of the authored pour boundary", async () => {
  const authoredDocument = parseAltiumPcbDoc(
    copperPourDefinitionRecords
      .filter((record) => !record.includes("REGIONKIND=COPPER"))
      .join("\n"),
  )
  const savedDocument = parseAltiumPcbDoc(
    copperPourDefinitionRecords.join("\n"),
  )
  const authored = convertAltiumPcbDocToCircuitJson(authoredDocument)
  const imported = convertAltiumPcbDocToCircuitJson(savedDocument)
  expect(
    authored.filter((element) => element.type === "pcb_copper_pour"),
  ).toHaveLength(1)
  expect(
    imported.filter((element) => element.type === "pcb_copper_pour"),
  ).toHaveLength(2)
  const comparison = stackSvgsHorizontally(
    [authored, imported].map((circuitJson) =>
      convertCircuitJsonToPcbSvg(circuitJson, {
        width: 600,
        height: 480,
        backgroundColor: "white",
        includeVersion: false,
        showSolderMask: false,
      }),
    ),
    {
      gap: 24,
      normalizeSize: false,
      rootAttributes: {
        "aria-label":
          "Authored pour boundary on left; imported cached copper with an obsolete routing gap on right",
      },
    },
  )
  await expect(comparison).toMatchSvgSnapshot(import.meta.path)
})
