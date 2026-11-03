import { expect, test } from "bun:test"
import { createElement } from "react"
import { RootCircuit, getSimpleRouteJsonFromCircuitJson } from "@tscircuit/core"

test("a small fixed copper region does not become a board-sized routing obstacle", async () => {
  const circuit = new RootCircuit()
  circuit.add(createElement("board", {width:10,height:8,routingDisabled:true},
    createElement("net", {name:"VDDIO"}),
    createElement("copperpour", {
      layer:"top",connectsTo:"net.VDDIO",unbroken:true,clearance:0,
      outline:[{x:1,y:1},{x:1.15,y:1},{x:1.15,y:1.25},{x:1,y:1.25}],
    }),
  ))
  await circuit.renderUntilSettled()
  const {simpleRouteJson}=getSimpleRouteJsonFromCircuitJson({db:circuit.db,subcircuitComponent:circuit._getBoard()!})
  const copper=simpleRouteJson.obstacles.filter(obstacle=>obstacle.isCopperPour)
  expect(copper).toHaveLength(1)
  expect(copper[0]!.width).toBeCloseTo(0.15,8)
  expect(copper[0]!.height).toBeCloseTo(0.25,8)
  expect(copper[0]!.center).toEqual({x:1.075,y:1.125})
})
