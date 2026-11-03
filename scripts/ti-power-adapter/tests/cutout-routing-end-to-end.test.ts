import {expect,test} from "bun:test"
import {createElement} from "react"
import {RootCircuit} from "@tscircuit/core"
import {checkCopperToCutoutClearance} from "@tscircuit/checks"
import {preserveCutoutRoutingClearance} from "../preserve-cutout-routing-clearance"

test("core routes around the physical cutout boundary instead of crossing a missed thin branch",async()=>{
  const findings=[]
  for(const preserve of [false,true]){
    const circuit=new RootCircuit()
    if(preserve)circuit.on("autorouting:start",event=>preserveCutoutRoutingClearance({srj:event.simpleRouteJson,circuitJson:circuit.db.toArray()}))
    circuit.add(createElement("board",{width:10,height:10,layers:8,autorouter:"auto-local",routeRemaining:true,placementDrcChecksDisabled:true},
      createElement("resistor",{name:"R1",resistance:"1k",footprint:"0402",pcbX:2,pcbY:-1,connections:{pin1:"net.signal"}}),
      createElement("resistor",{name:"R2",resistance:"1k",footprint:"0402",pcbX:2,pcbY:1,connections:{pin1:"net.signal"}}),
      createElement("cutout",{shape:"polygon",points:[{x:0,y:0},{x:3,y:0},{x:3,y:0.1},{x:0.1,y:0.1},{x:0.1,y:3},{x:0,y:3}]}),
    ))
    await circuit.renderUntilSettled()
    const json=circuit.getCircuitJson()
    expect(json.filter(e=>e.type==="pcb_trace").length).toBeGreaterThan(0)
    findings.push(checkCopperToCutoutClearance(json).length)
  }
  expect(findings[0]).toBeGreaterThan(0)
  expect(findings[1]).toBe(0)
})
