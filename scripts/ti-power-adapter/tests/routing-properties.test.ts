import { expect, test } from "bun:test"
import { parseAltiumPcbDoc } from "altiumts"
import { renderBoard } from "../render-board"

test("original minimum trace and via dimensions survive conversion into core", async () => {
  const document=parseAltiumPcbDoc([
    "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=500mil|VY1=0mil|VX2=500mil|VY2=400mil|VX3=0mil|VY3=400mil",
    "|RECORD=Net|NAME=GND",
    "|RECORD=Rule|RULEKIND=Clearance|SCOPE1EXPRESSION=All|SCOPE2EXPRESSION=All|GAP=5.5mil",
    "|RECORD=Rule|RULEKIND=Width|SCOPE1EXPRESSION=All|SCOPE2EXPRESSION=All|MINLIMIT=6mil|PREFEREDWIDTH=10mil|MAXLIMIT=20mil",
    "|RECORD=Rule|RULEKIND=RoutingVias|SCOPE1EXPRESSION=All|SCOPE2EXPRESSION=All|MINWIDTH=8mil|MINHOLEWIDTH=4mil",
    "|RECORD=Polygon|ID=1|LAYER=TOP|NET=0|VX0=50mil|VY0=50mil|VX1=450mil|VY1=50mil|VX2=450mil|VY2=350mil|VX3=50mil|VY3=350mil",
  ].join("\n"))
  const output=await renderBoard(document,{routingDisabled:true})
  const board=output.circuitJson.find(e=>e.type==="pcb_board")!
  if (board.type!=="pcb_board") throw new Error("Missing rendered board")
  expect(board.min_trace_width).toBeCloseTo(.1524)
  expect(board.min_via_pad_diameter).toBeCloseTo(.2032)
  expect(board.min_via_hole_diameter).toBeCloseTo(.1016)
  const net=output.circuitJson.find(e=>e.type==="source_net"&&e.name==="GND")!
  expect(net.type==="source_net"&&net.trace_width).toBeCloseTo(.254)
},30000)
