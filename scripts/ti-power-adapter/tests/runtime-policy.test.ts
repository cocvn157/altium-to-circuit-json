import { beforeAll, expect, test } from "bun:test"
import { pointToSegmentDistance } from "@tscircuit/math-utils"
import { CopperPourPipelineSolver, initializeManifoldGeometry } from "../solver/lib/index"
import type { InputProblem } from "../solver/lib/types"

beforeAll(initializeManifoldGeometry)

test("runtime policy applies different minimum gaps without adding serialized fields", () => {
  const input: InputProblem = {
    regionsForPour: [{ shape: "rect", layer: "top", bounds: {minX:-8,minY:-8,maxX:8,maxY:8}, connectivityKey: "GND", padMargin: .14, traceMargin: .14 }],
    pads: [
      { shape:"circle", padId:"HV", layer:"top", connectivityKey:"HV",x:-3,y:0,radius:.5 },
      { shape:"circle", padId:"EARTH", layer:"top", connectivityKey:"EARTH",x:3,y:0,radius:.5 },
    ],
  }
  const serialized = JSON.stringify(input)
  const output = new CopperPourPipelineSolver(input, { padClearance: ({pad}) => pad.padId === "HV" ? 1.524 : 4.14 }).getOutput()
  expect(JSON.stringify(input)).toBe(serialized)
  for (const pad of input.pads) {
    if (pad.shape !== "circle") throw new Error("Expected circle")
    const required = pad.padId === "HV" ? 1.524 : 4.14
    for (const shape of output.brep_shapes) for (const ring of [shape.outer_ring, ...shape.inner_rings]) {
      for (let angle=0;angle<2*Math.PI;angle+=Math.PI/128) {
        const point={x:pad.x+pad.radius*Math.cos(angle),y:pad.y+pad.radius*Math.sin(angle)}
        for (let i=0;i<ring.vertices.length;i++) expect(pointToSegmentDistance(point,ring.vertices[i]!,ring.vertices[(i+1)%ring.vertices.length]!)).toBeGreaterThanOrEqual(required)
      }
    }
  }
})

test("omitting runtime policy preserves the published solver output", () => {
  const input: InputProblem={regionsForPour:[{shape:"rect",layer:"top",bounds:{minX:0,minY:0,maxX:4,maxY:4},connectivityKey:"GND",padMargin:.2,traceMargin:.2}],pads:[]}
  const output=new CopperPourPipelineSolver(input).getOutput()
  expect(output.brep_shapes).toHaveLength(1)
  expect(output.brep_shapes[0]!.outer_ring.vertices).toHaveLength(4)
})
