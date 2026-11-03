import { expect, test } from "bun:test"
import { parseAltiumPcbDoc } from "altiumts"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { renderBoard } from "../render-board"

test("both physical pads of a shared pin remain connected to their authored net in core", async () => {
  const document = parseAltiumPcbDoc([
    "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=800mil|VY1=0mil|VX2=800mil|VY2=800mil|VX3=0mil|VY3=800mil",
    "|RECORD=Net|NAME=SIGNAL",
    "|RECORD=Component|ID=0|LAYER=TOP|X=200mil|Y=200mil|SOURCEDESIGNATOR=K1",
    "|RECORD=Pad|NAME=4|COMPONENT=0|NET=0|LAYER=MULTILAYER|X=200mil|Y=200mil|XSIZE=80mil|YSIZE=80mil|SHAPE=ROUND|HOLESIZE=40mil|PLATED=TRUE",
    "|RECORD=Pad|NAME=4|COMPONENT=0|NET=0|LAYER=MULTILAYER|X=200mil|Y=400mil|XSIZE=80mil|YSIZE=80mil|SHAPE=ROUND|HOLESIZE=40mil|PLATED=TRUE",
  ].join("\n"))
  const { circuitJson } = await renderBoard(document, { routingDisabled: true })
  const connectivity = getFullConnectivityMapFromCircuitJson(circuitJson)
  const net = circuitJson.find(e => e.type === "source_net" && e.name === "SIGNAL")!
  if (net.type !== "source_net") throw new Error("Missing source net")
  const key = connectivity.getNetConnectedToId(net.source_net_id)
  expect(key).toBeDefined()
  const pads = circuitJson.filter(e => e.type === "pcb_plated_hole")
  expect(pads).toHaveLength(2)
  for (const pad of pads) expect(connectivity.getNetConnectedToId(pad.pcb_plated_hole_id)).toBe(key)
}, 30000)
