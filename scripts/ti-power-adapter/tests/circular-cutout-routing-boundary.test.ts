import { expect, test } from "bun:test"
import { getSimpleRouteJsonFromCircuitJson } from "@tscircuit/core"
import type { AnyCircuitElement } from "circuit-json"
import { preserveCutoutRoutingClearance } from "../preserve-cutout-routing-clearance"

test("a circular cutout uses one physical hole enclosing its authored polygon", () => {
  const points = Array.from({length: 48}, (_, index) => ({
    x: 3 + 1.6 * Math.cos(index * Math.PI / 24),
    y: 2 + 1.6 * Math.sin(index * Math.PI / 24),
  }))
  const circuitJson: AnyCircuitElement[] = [
    {type:"pcb_board",pcb_board_id:"board",center:{x:0,y:0},width:20,height:20,num_layers:8,thickness:1.6,material:"fr4",min_board_edge_clearance:0.2,min_trace_to_hole_edge_clearance:0.2},
    {type:"pcb_cutout",pcb_cutout_id:"round_cutout",shape:"polygon",points},
  ]
  const before = JSON.stringify(circuitJson)
  const {simpleRouteJson:srj} = getSimpleRouteJsonFromCircuitJson({circuitJson})
  const count = srj.obstacles.length
  preserveCutoutRoutingClearance({srj,circuitJson})
  const added = srj.obstacles.slice(count)
  expect(added).toHaveLength(1)
  expect(added[0]!.shape).toBe("circle")
  expect(added[0]!.isNonPlatedHole).toBe(true)
  expect(added[0]!.layers).toHaveLength(8)
  for (const point of points) {
    expect(Math.hypot(point.x-added[0]!.center.x,point.y-added[0]!.center.y)).toBeLessThan(added[0]!.width/2)
  }
  expect(JSON.stringify(circuitJson)).toBe(before)
})
