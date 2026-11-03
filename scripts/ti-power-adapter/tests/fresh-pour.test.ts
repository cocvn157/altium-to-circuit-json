import { expect, test } from "bun:test"
import { parseAltiumPcbDoc } from "altiumts"
import { renderBoard } from "../render-board"
import { hasCopperPourAt } from "./geometry"

test("published converters and core route first, then fresh copper fills old cached gaps", async () => {
  const document = parseAltiumPcbDoc([
    "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=500mil|VY1=0mil|VX2=500mil|VY2=400mil|VX3=0mil|VY3=400mil|VX4=0mil|VY4=0mil",
    "|RECORD=Net|NAME=GND", "|RECORD=Net|NAME=SIGNAL",
    "|RECORD=Rule|RULEKIND=Clearance|ENABLED=TRUE|PRIORITY=1|SCOPE1EXPRESSION=InPolygon|SCOPE2EXPRESSION=All|GAP=10mil",
    "|RECORD=Rule|RULEKIND=Clearance|ENABLED=TRUE|PRIORITY=2|SCOPE1EXPRESSION=All|SCOPE2EXPRESSION=All|GAP=5mil",
    "|RECORD=Polygon|ID=7|LAYER=TOP|NET=0|VX0=50mil|VY0=50mil|VX1=450mil|VY1=50mil|VX2=450mil|VY2=350mil|VX3=50mil|VY3=350mil",
    "|RECORD=Region|POLYGON=7|LAYER=TOP|NET=0|REGIONKIND=COPPER|VX0=50mil|VY0=50mil|VX1=200mil|VY1=50mil|VX2=200mil|VY2=350mil|VX3=50mil|VY3=350mil",
    "|RECORD=Region|POLYGON=7|LAYER=TOP|NET=0|REGIONKIND=COPPER|VX0=250mil|VY0=50mil|VX1=450mil|VY1=50mil|VX2=450mil|VY2=350mil|VX3=250mil|VY3=350mil",
    "|RECORD=Component|ID=0|LAYER=TOP|X=100mil|Y=200mil|SOURCEDESIGNATOR=A",
    "|RECORD=Component|ID=1|LAYER=TOP|X=400mil|Y=200mil|SOURCEDESIGNATOR=B",
    "|RECORD=Component|ID=2|LAYER=TOP|X=100mil|Y=100mil|SOURCEDESIGNATOR=G",
    "|RECORD=Pad|NAME=1|COMPONENT=0|NET=1|LAYER=TOP|X=100mil|Y=200mil|XSIZE=20mil|YSIZE=20mil|SHAPE=RECTANGLE",
    "|RECORD=Pad|NAME=1|COMPONENT=1|NET=1|LAYER=TOP|X=400mil|Y=200mil|XSIZE=20mil|YSIZE=20mil|SHAPE=RECTANGLE",
    "|RECORD=Pad|NAME=1|COMPONENT=2|NET=0|LAYER=TOP|X=100mil|Y=100mil|XSIZE=20mil|YSIZE=20mil|SHAPE=RECTANGLE",
  ].join("\n"))
  const output = await renderBoard(document)
  expect(output.definitions).toBe(1)
  expect(output.circuitJson.some(e=>e.type==="pcb_trace")).toBe(true)
  expect(output.pours.length).toBeGreaterThan(0)
  const pourIds = new Set(output.pours.map(p => p.pcb_copper_pour_id))
  for (const trace of output.circuitJson) if (trace.type === "pcb_trace") for (const point of trace.route) {
    if (point.route_type === "wire" && point.copper_pour_id) expect(pourIds.has(point.copper_pour_id)).toBe(true)
  }
  expect(hasCopperPourAt(output.circuitJson, {x:5.715,y:3.81})).toBe(true)
  expect(hasCopperPourAt(output.circuitJson, {x:5.715,y:5.28})).toBe(false)
  // Existing schema fields only: no original-rule metadata survives into the result.
  for (const pour of output.pours) expect(Object.keys(pour).sort()).toEqual(["brep_shape","covered_with_solder_mask","layer","pcb_copper_pour_id","shape","source_net_id","subcircuit_id","type"].sort())
}, 30000)
