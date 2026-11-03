import { expect, test } from "bun:test"
import { parseAltiumPcbDoc } from "altiumts"
import { getPlatedHolePolygon } from "@tscircuit/circuit-json-util"
import { readBoard } from "../read-board"
import { renderBoard } from "../render-board"

test("vertical and horizontal slots retain both native drill axes through TSX and core", async () => {
  const document = parseAltiumPcbDoc([
    "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=800mil|VY1=0mil|VX2=800mil|VY2=800mil|VX3=0mil|VY3=800mil",
    "|RECORD=Pad|NAME=1|LAYER=MULTILAYER|X=200mil|Y=200mil|XSIZE=80mil|YSIZE=220mil|SHAPE=ROUND|HOLESIZE=190mil|HOLETYPE=2|SLOTLENGTH=60mil|ROTATION=180|PLATED=TRUE",
    "|RECORD=Pad|NAME=2|LAYER=MULTILAYER|X=500mil|Y=200mil|XSIZE=220mil|YSIZE=80mil|SHAPE=ROUND|HOLESIZE=60mil|HOLETYPE=2|SLOTLENGTH=190mil|PLATED=TRUE",
  ].join("\n"))
  const imported = readBoard(document).circuitJson.filter(e => e.type === "pcb_plated_hole")
  const rendered = (await renderBoard(document, { routingDisabled: true })).circuitJson.filter(e => e.type === "pcb_plated_hole")
  for (const holes of [imported, rendered]) {
    expect(holes).toHaveLength(2)
    const box = getPlatedHolePolygon(holes[0], 180).box
    expect(box.xmax - box.xmin).toBeCloseTo(2.032)
    expect(box.ymax - box.ymin).toBeCloseTo(5.588)
    if (!("hole_width" in holes[0]) || !("hole_width" in holes[1])) throw new Error("Expected slots")
    expect(holes[0].hole_width).toBeCloseTo(1.524)
    expect(holes[0].hole_height).toBeCloseTo(4.826)
    expect(holes[1].hole_width).toBeCloseTo(4.826)
    expect(holes[1].hole_height).toBeCloseTo(1.524)
  }
}, 30000)
