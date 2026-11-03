import { beforeAll, expect, test } from "bun:test"
import { CopperPourPipelineSolver, initializeManifoldGeometry } from "../solver/lib/index"
import type { InputPourRegion } from "../solver/lib/types"

beforeAll(initializeManifoldGeometry)

test("authored copper remains intact and reserves the applicable gap in either declaration order", () => {
  const fixed: InputPourRegion={shape:"rect",layer:"top",bounds:{minX:-1,minY:-1,maxX:1,maxY:1},connectivityKey:"HV",padMargin:.1,traceMargin:.1,board_edge_margin:.8}
  const generated: InputPourRegion={shape:"rect",layer:"top",bounds:{minX:-5,minY:-5,maxX:5,maxY:5},connectivityKey:"GND",padMargin:.1,traceMargin:.1}
  for (const regionsForPour of [[fixed,generated],[generated,fixed]]) {
    const output=new CopperPourPipelineSolver({regionsForPour,pads:[{shape:"circle",padId:"foreign",connectivityKey:"OTHER",layer:"top",x:0,y:0,radius:.5}]},{fixedRegions:new Set([regionsForPour.indexOf(fixed)]),pourClearance:()=>1.5}).getOutput()
    const preserved=output.brep_shapes_by_region[regionsForPour.indexOf(fixed)]!
    expect(preserved).toHaveLength(1)
    expect(preserved[0]!.inner_rings).toHaveLength(0)
    expect(Math.max(...preserved[0]!.outer_ring.vertices.map(v=>v.x))).toBe(1)
    const refill=output.brep_shapes_by_region[regionsForPour.indexOf(generated)]!
    expect(refill[0]!.inner_rings.length).toBeGreaterThan(0)
    expect(Math.max(...refill[0]!.inner_rings[0]!.vertices.map(v=>v.x))).toBeGreaterThanOrEqual(2.5)
  }
})
