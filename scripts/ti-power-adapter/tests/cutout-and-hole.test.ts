import { beforeAll, expect, test } from "bun:test"
import { CopperPourPipelineSolver, initializeManifoldGeometry } from "../solver/lib/index"
import { hasCopperPourAt } from "./geometry"

beforeAll(initializeManifoldGeometry)

test("physical slots use board-edge spacing while drill holes use electrical spacing", () => {
  const result=new CopperPourPipelineSolver({
    regionsForPour:[{shape:"rect",layer:"top",bounds:{minX:-8,minY:-4,maxX:8,maxY:4},connectivityKey:"GND",padMargin:.14,traceMargin:.14,cutout_margin:.635}],
    pads:[
      {shape:"circle",padId:"drill",connectivityKey:"hole:drill",layer:"top",x:-3,y:0,radius:.3},
      {shape:"rect",padId:"slot",connectivityKey:"cutout:slot",layer:"top",bounds:{minX:2.5,minY:-.5,maxX:3.5,maxY:.5}},
    ],
  },{padClearance:()=>.14}).getOutput()
  const copper=result.brep_shapes.map((brep_shape,i)=>({type:"pcb_copper_pour" as const,pcb_copper_pour_id:`computed_${i}`,shape:"brep" as const,layer:"top" as const,covered_with_solder_mask:true,brep_shape}))
  expect(hasCopperPourAt(copper,{x:-2.55,y:0})).toBe(true)
  expect(hasCopperPourAt(copper,{x:4,y:0})).toBe(false)
  expect(hasCopperPourAt(copper,{x:4.2,y:0})).toBe(true)
})
