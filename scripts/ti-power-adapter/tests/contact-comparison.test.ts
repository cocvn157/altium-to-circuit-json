import { expect,test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkCopperPourShorts } from "@tscircuit/checks"
import { compareCopperContacts } from "../compare-copper-contacts"

test("authored metal accepts an already-contacted net while a newly introduced net stays a regression",()=>{
  const source:AnyCircuitElement[]=[
    {type:"pcb_board",pcb_board_id:"board",center:{x:0,y:0},width:20,height:20,num_layers:2,thickness:1.6,material:"fr4"},
    {type:"source_net",source_net_id:"a",name:"A",member_source_group_ids:[]},
    {type:"source_net",source_net_id:"b",name:"B",member_source_group_ids:[]},
    {type:"source_trace",source_trace_id:"ta",connected_source_port_ids:[],connected_source_net_ids:["a"]},
    {type:"source_trace",source_trace_id:"tb",connected_source_port_ids:[],connected_source_net_ids:["b"]},
    {type:"pcb_copper_pour",pcb_copper_pour_id:"metal",shape:"rect",center:{x:0,y:0},width:2,height:2,layer:"top",covered_with_solder_mask:true},
    {type:"pcb_trace",pcb_trace_id:"old_a",source_trace_id:"ta",route:[{route_type:"wire",x:-2,y:0,width:.2,layer:"top"},{route_type:"wire",x:0,y:0,width:.2,layer:"top"}]},
  ]
  const wire=(id:string,net:string):AnyCircuitElement=>({type:"pcb_trace",pcb_trace_id:id,source_trace_id:net,route:[{route_type:"wire",x:0,y:.5,width:.2,layer:"top"},{route_type:"wire",x:2,y:.5,width:.2,layer:"top"}]})
  const same=[...source,wire("new_a","ta")],foreign=[...source,wire("new_b","tb")]
  const compare=(output:AnyCircuitElement[])=>compareCopperContacts({source,output,sourceContacts:checkCopperPourShorts(source),outputContacts:checkCopperPourShorts(output),runtimeNames:new Map()})
  expect(compare(same).added).toHaveLength(0)
  expect(compare(foreign).added).toHaveLength(1)
})
