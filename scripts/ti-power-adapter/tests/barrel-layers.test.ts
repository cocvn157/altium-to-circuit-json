import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { expandBarrelLayers } from "../expand-barrel-layers"
import { convertCircuitJsonToInputProblem } from "../solver/lib/index"

test("through-hole endpoints expose their physical span to inner pours without changing routing ports", () => {
  const source: AnyCircuitElement[] = [
    {type:"pcb_board",pcb_board_id:"board",center:{x:0,y:0},width:10,height:10,num_layers:4,thickness:1.6,material:"fr4"},
    {type:"source_net",source_net_id:"ground",name:"GND",member_source_group_ids:[],subcircuit_connectivity_map_key:"GND"},
    {type:"pcb_port",pcb_port_id:"port",source_port_id:"source_port",pcb_component_id:"component",x:0,y:0,layers:["top","bottom"]},
    {type:"pcb_plated_hole",pcb_plated_hole_id:"hole",pcb_port_id:"port",x:0,y:0,shape:"circle",outer_diameter:2,hole_diameter:1,layers:["top","bottom"]},
  ]
  const normalized=expandBarrelLayers(source)
  expect(normalized.find(e=>e.type==="pcb_plated_hole")!.layers).toEqual(["top","inner1","inner2","bottom"])
  expect(normalized.find(e=>e.type==="pcb_port")!.layers).toEqual(["top","bottom"])
  expect(source.find(e=>e.type==="pcb_plated_hole")!.layers).toEqual(["top","bottom"])
  const input=convertCircuitJsonToInputProblem(normalized,{layer:"inner1",source_net_id:"ground",pad_margin:.2,trace_margin:.2})
  expect(input.pads.some(p=>p.padId==="hole")).toBe(true)
})
