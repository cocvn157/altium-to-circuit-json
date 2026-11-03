import { expect, test } from "bun:test"
import { parseAltiumPcbDoc } from "altiumts"
import { renderBoard } from "../render-board"

test("standalone unassigned copper keeps its geometry and has no invented electrical net", async () => {
  const document=parseAltiumPcbDoc([
    "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=500mil|VY1=0mil|VX2=500mil|VY2=400mil|VX3=0mil|VY3=400mil",
    "|RECORD=Net|NAME=GND",
    "|RECORD=Rule|RULEKIND=Clearance|SCOPE1EXPRESSION=All|SCOPE2EXPRESSION=All|GAP=5.5mil",
    "|RECORD=Fill|LAYER=TOP|X1=100mil|Y1=100mil|X2=200mil|Y2=150mil",
  ].join("\n"))
  const output=await renderBoard(document,{routingDisabled:true})
  expect(output.fixed).toBe(1)
  expect(output.pours).toHaveLength(1)
  expect(output.pours[0]!.source_net_id).toBeUndefined()
  expect(output.pours[0]).toMatchObject({shape:"rect",width:2.54,height:1.27})
},30000)
