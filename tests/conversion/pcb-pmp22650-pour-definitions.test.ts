import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc } from "altiumts"
import { convertAltiumPcbDocToCircuitJson } from "../../lib"
import { convertAltiumCopperAreas } from "../../lib/pcb/copperAreas/convertAltiumCopperAreas"
import { TI_POWER_REFERENCE_PCB_FILENAMES } from "../../scripts/references/reference-manifest"
import { readReferenceBytes } from "../helpers/read-reference"

test("PMP22650 keeps authored copper when replacing cached polygon fills", async () => {
  const document = parseAltiumBinaryPcbDoc(
    await readReferenceBytes(TI_POWER_REFERENCE_PCB_FILENAMES.pmp22650),
  )
  const saved = convertAltiumCopperAreas(document)
  const definitions = convertAltiumPcbDocToCircuitJson(document, {
    copperPourMode: "recompute",
    includeTraces: false,
    includeVias: false,
    includeCadModels: false,
  }).filter((element) => element.type === "pcb_copper_pour")
  const standaloneIds = [
    "pcb_copper_pour_altium_region_10774",
    "pcb_copper_pour_altium_region_10917",
  ]
  const standalone = saved.filter((pour) =>
    standaloneIds.includes(pour.pcb_copper_pour_id),
  )
  expect(saved).toHaveLength(401)
  expect(standalone).toHaveLength(2)
  expect(definitions).toHaveLength(391)
  expect(
    definitions.filter((pour) => pour.pcb_copper_pour_id.includes("_polygon_")),
  ).toHaveLength(389)
  expect(
    definitions.filter(
      (pour) => !pour.pcb_copper_pour_id.includes("_polygon_"),
    ),
  ).toEqual(
    standalone.map((pour) =>
      expect.objectContaining({
        ...pour,
        source_net_id: expect.any(String),
        is_static: true,
      }),
    ),
  )
  expect(
    definitions
      .filter((pour) => !pour.is_static)
      .every((pour) => pour.board_edge_margin === 0.635),
  ).toBe(true)
}, 30000)
