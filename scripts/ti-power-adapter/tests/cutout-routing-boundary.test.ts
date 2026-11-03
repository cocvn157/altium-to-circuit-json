import { expect, test } from "bun:test"
import { getSimpleRouteJsonFromCircuitJson } from "@tscircuit/core"
import type { AnyCircuitElement } from "circuit-json"
import { preserveCutoutRoutingClearance } from "../preserve-cutout-routing-clearance"

test("a thin cutout branch remains blocked on every physical layer", () => {
  const circuitJson: AnyCircuitElement[] = [
    {type:"pcb_board",pcb_board_id:"board",center:{x:0,y:0},width:10,height:10,num_layers:8,thickness:1.6,material:"fr4",min_board_edge_clearance:0.2,min_trace_to_hole_edge_clearance:0.2,min_trace_to_pad_edge_clearance:0.1,min_pad_edge_to_pad_edge_clearance:0.1},
    {type:"pcb_cutout",pcb_cutout_id:"thin_branch",shape:"polygon",points:[{x:0,y:0},{x:3,y:0},{x:3,y:0.1},{x:0.1,y:0.1},{x:0.1,y:3},{x:0,y:3}]},
  ]
  const before = JSON.stringify(circuitJson)
  const {simpleRouteJson:srj} = getSimpleRouteJsonFromCircuitJson({circuitJson})
  const covers = (obstacle: typeof srj.obstacles[number]) => Math.abs(2-obstacle.center.x)<=obstacle.width/2 && Math.abs(0.05-obstacle.center.y)<=obstacle.height/2
  expect(srj.obstacles.some(covers)).toBe(false)
  preserveCutoutRoutingClearance({srj,circuitJson})
  const boundary = srj.obstacles.find(covers)
  expect(boundary).toBeDefined()
  expect(boundary!.layers).toEqual(["top","inner1","inner2","inner3","inner4","inner5","inner6","bottom"])
  expect(boundary!.connectedTo).toEqual([])
  expect(JSON.stringify(circuitJson)).toBe(before)
})
