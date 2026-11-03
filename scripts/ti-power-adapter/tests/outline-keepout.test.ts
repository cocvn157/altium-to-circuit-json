import { expect, test } from "bun:test"
import { RootCircuit, Board } from "@tscircuit/core"
import { ImportedKeepouts } from "../ImportedKeepouts"

test("authored keepout paths survive core rendering without a props or schema addition", async () => {
  const circuit=new RootCircuit()
  const board=new Board({width:10,height:10,routingDisabled:true})
  board.add(new ImportedKeepouts({keepouts:[{type:"pcb_keepout",pcb_keepout_id:"original_path",shape:"outline",layers:["top"],outline:[{x:-2,y:0},{x:0,y:1},{x:2,y:0}],stroke_width:.3}]}))
  circuit.add(board)
  await circuit.renderUntilSettled()
  const keepout=circuit.getCircuitJson().find(e=>e.type==="pcb_keepout")!
  expect(keepout).toMatchObject({shape:"outline",stroke_width:.3,outline:[{x:-2,y:0},{x:0,y:1},{x:2,y:0}]})
},30000)
