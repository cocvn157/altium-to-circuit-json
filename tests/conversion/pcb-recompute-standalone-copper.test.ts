import { expect, test } from "bun:test"
import { parseAltiumPcbDoc } from "altiumts"
import { convertAltiumPcbDocToCircuitJson } from "../../lib"
import { copperPourDefinitionRecords } from "../fixtures/copper-pour-definition"

test.each(["", "|POLYGON=65535", "|POLYGON=-1", "|POLYGON=42"])(
  "keeps standalone copper while removing cached polygon copper: %s",
  (reference) => {
    const document = parseAltiumPcbDoc(
      [
        ...copperPourDefinitionRecords,
        `|RECORD=Region${reference}|LAYER=BOTTOM|NET=0|REGIONKIND=COPPER|VX0=50mil|VY0=50mil|VX1=150mil|VY1=50mil|VX2=150mil|VY2=150mil|VX3=50mil|VY3=150mil`,
        `|RECORD=Fill${reference}|LAYER=BOTTOM|NET=0|X1=200mil|Y1=50mil|X2=300mil|Y2=150mil|ROTATION=15`,
        "|RECORD=Fill|POLYGON=7|LAYER=TOP|NET=0|X1=50mil|Y1=50mil|X2=100mil|Y2=100mil",
      ].join("\n"),
    )
    const preserved = convertAltiumPcbDocToCircuitJson(document)
    const definitions = convertAltiumPcbDocToCircuitJson(document, {
      copperPourMode: "recompute",
    })
    const standalone = preserved.filter(
      (element) =>
        element.type === "pcb_copper_pour" && element.layer === "bottom",
    )
    expect(standalone).toHaveLength(2)
    expect(
      definitions.filter((element) => element.type === "pcb_copper_pour"),
    ).toEqual([
      expect.objectContaining({
        pcb_copper_pour_id: "pcb_copper_pour_altium_polygon_0",
        layer: "top",
      }),
      ...standalone,
    ])
    expect(standalone).toEqual([
      expect.objectContaining({
        shape: "polygon",
        source_net_id: expect.any(String),
      }),
      expect.objectContaining({
        shape: "rect",
        rotation: 15,
        source_net_id: expect.any(String),
      }),
    ])
  },
)
