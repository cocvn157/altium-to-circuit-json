import { expect, test } from "bun:test"
import { parseAltiumPcbDoc } from "altiumts"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { stackSvgsHorizontally } from "stack-svgs"
import { convertAltiumPcbDocToCircuitJson } from "../../lib"
import { copperPourDefinitionRecords } from "../fixtures/copper-pour-definition"
import { hasCopperAt } from "../helpers/hasCopperAt"
test("imports authored pour definitions and global clearance for recomputation", async () => {
  const document = parseAltiumPcbDoc(copperPourDefinitionRecords.join("\n"))
  const preserved = convertAltiumPcbDocToCircuitJson(document)
  expect(
    convertAltiumPcbDocToCircuitJson(document, { copperPourMode: "preserve" }),
  ).toEqual(preserved)
  const recomputed = convertAltiumPcbDocToCircuitJson(document, {
    copperPourMode: "recompute",
  })
  const pours = recomputed.filter(
    (element) => element.type === "pcb_copper_pour",
  )
  expect(pours).toHaveLength(1)
  expect(pours[0]).toMatchObject({
    pcb_copper_pour_id: "pcb_copper_pour_altium_polygon_0",
    source_net_id: expect.any(String),
    layer: "top",
    shape: "brep",
  })
  expect(hasCopperAt(pours, { x: 5.715, y: 3.81 })).toBe(true)
  expect(hasCopperAt(pours, { x: 9.525, y: 6.985 })).toBe(false)
  expect(
    recomputed.find((element) => element.type === "pcb_board"),
  ).toMatchObject({
    min_trace_to_pad_edge_clearance: 0.254,
    min_different_net_trace_edge_to_trace_edge_clearance: 0.254,
    min_pad_edge_to_pad_edge_clearance: 0.254,
  })
  expect(
    recomputed.find((element) => element.type === "source_net"),
  ).toMatchObject({ source_net_id: pours[0]?.source_net_id, name: "GND" })
  expect(
    convertAltiumPcbDocToCircuitJson(document, {
      copperPourMode: "recompute",
      includeCopperAreas: false,
    }).some((element) => element.type === "pcb_copper_pour"),
  ).toBe(false)
  for (const replacement of ["", "|SCOPE1EXPRESSION=InNet('HV')"]) {
    const records = replacement
      ? copperPourDefinitionRecords.map((record) =>
          record.replace("|SCOPE1EXPRESSION=All", replacement),
        )
      : copperPourDefinitionRecords.filter(
          (record) => !record.includes("RULEKIND=Clearance"),
        )
    expect(() =>
      convertAltiumPcbDocToCircuitJson(parseAltiumPcbDoc(records.join("\n")), {
        copperPourMode: "recompute",
      }),
    ).toThrow(/clearance rule/)
  }
  const comparison = stackSvgsHorizontally(
    [preserved, recomputed].map((circuitJson) =>
      convertCircuitJsonToPcbSvg(circuitJson, {
        width: 600,
        height: 480,
        backgroundColor: "white",
        includeVersion: false,
        showSolderMask: false,
      }),
    ),
    { gap: 24, normalizeSize: false },
  )
  await expect(comparison).toMatchSvgSnapshot(import.meta.path)
})
