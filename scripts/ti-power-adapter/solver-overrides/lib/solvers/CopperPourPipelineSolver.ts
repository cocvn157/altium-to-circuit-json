import { BasePipelineSolver } from "@tscircuit/solver-utils"
import type { BRepShape } from "circuit-json"
import type { InputProblem, PipelineOutput } from "../types"
import { applyCrosshatch } from "./copper-pour/apply-crosshatch"
import { generateBRep } from "./copper-pour/generate-brep"
import { getBoardPolygon } from "./copper-pour/get-board-polygon"
import {
  crossSectionToCopperPourIslands,
  intersectCrossSections,
  offsetCrossSection,
  removeTinyIslands,
  subtractBlockersFromPour,
  subtractCrossSectionBlockers,
} from "./copper-pour/manifold-geometry-adapter"
import { isManifoldGeometryInitialized } from "./copper-pour/manifold-runtime"
import { processObstaclesForPour } from "./copper-pour/process-obstacles"
import type { CopperPourRuntimeOptions } from "../runtime-options"
import { getConservativeClearance } from "./copper-pour/get-conservative-clearance"

export class CopperPourPipelineSolver extends BasePipelineSolver<InputProblem> {
  pipelineDef = []
  constructor(public input: InputProblem, private readonly runtime: CopperPourRuntimeOptions = {}) {
    super(input)
  }

  override getSolverName(): string {
    return "CopperPourPipelineSolver"
  }

  override getOutput(): PipelineOutput {
    if (!isManifoldGeometryInitialized()) {
      throw new Error(
        "Manifold geometry has not been initialized. Call initializeManifoldGeometry() before solving copper pours.",
      )
    }

    const brep_shapes_by_region: BRepShape[][] = this.input.regionsForPour.map(
      () => [],
    )
    const solvedRegions: Array<{
      layer: string
      connectivityKey: string
      regionIndex: number
      section: ReturnType<typeof subtractBlockersFromPour>
    }> = []

    // Later regions have higher priority, matching declaration/draw order.
    const regionIndices = this.input.regionsForPour
      .map((_, index) => index)
      .sort(
        (a, b) =>
          Number(this.runtime.fixedRegions?.has(b) ?? false) -
            Number(this.runtime.fixedRegions?.has(a) ?? false) || b - a,
      )
    for (const regionIndex of regionIndices) {
      const region = this.input.regionsForPour[regionIndex]!
      const isStatic = this.runtime.fixedRegions?.has(regionIndex) ?? false
      const boardPolygon = getBoardPolygon(region)

      const padsForLayer = this.input.pads.filter(
        (p) => p.layer === region.layer,
      )

      const pourMargins = {
        padMargin: region.padMargin,
        traceMargin: region.traceMargin,
        board_edge_margin: region.board_edge_margin,
        cutoutMargin: region.cutout_margin,
        use_thermal_reliefs: region.use_thermal_reliefs,
        thermal_relief_spoke_width: region.thermal_relief_spoke_width,
        thermal_relief_spoke_count: region.thermal_relief_spoke_count,
        resolveClearance: this.runtime.padClearance
          ? (pad: InputProblem["pads"][number]) => this.runtime.padClearance!({regionIndex, pad})
          : undefined,
      }
      const marginOutline = region.boardEdgeOutline ?? region.outline
      const { polygonsToSubtract, obstaclePolygons } = processObstaclesForPour(
        isStatic ? [] : padsForLayer,
        region.connectivityKey,
        pourMargins,
        isStatic ? undefined : marginOutline,
      )

      const higherPriorityPourBlockers = solvedRegions
        .filter(
          (solvedRegion) =>
            solvedRegion.layer === region.layer &&
            solvedRegion.connectivityKey !== region.connectivityKey,
        )
        .map((solvedRegion) =>
          offsetCrossSection(
            solvedRegion.section,
            this.runtime.pourClearance
              ? getConservativeClearance({ clearance: this.runtime.pourClearance({regionIndex, otherRegionIndex: solvedRegion.regionIndex}) })
              : Math.max(
                  region.pourMargin ?? Math.max(region.padMargin, region.traceMargin),
                  this.input.regionsForPour[solvedRegion.regionIndex]!.pourMargin ?? Math.max(this.input.regionsForPour[solvedRegion.regionIndex]!.padMargin, this.input.regionsForPour[solvedRegion.regionIndex]!.traceMargin),
                ),
          ),
        )

      const pourWithoutComponentObstacles = subtractBlockersFromPour(
        boardPolygon,
        isStatic ? [] : polygonsToSubtract,
      )
      const boardOutline = region.boardOutline ?? region.boardEdgeOutline
      const boardSection =
        !isStatic && boardOutline?.length
          ? subtractBlockersFromPour(
              boardOutline,
              processObstaclesForPour([], undefined, pourMargins, boardOutline)
                .polygonsToSubtract,
            )
          : undefined
      const clippedPour =
        boardSection && !isStatic
          ? intersectCrossSections(pourWithoutComponentObstacles, boardSection)
          : pourWithoutComponentObstacles

      const solidPour = isStatic
        ? clippedPour
        : removeTinyIslands(
            subtractCrossSectionBlockers(
              clippedPour,
              higherPriorityPourBlockers,
            ),
          )
      const finalPour =
        region.crosshatch && !isStatic
          ? applyCrosshatch({
              solidPour,
              hatchPitch: region.crosshatchPitch,
              hatchWidth: region.crosshatchWidth,
              padsForLayer,
              connectivityKey: region.connectivityKey,
              obstaclePolygons,
              higherPriorityPourBlockers,
            })
          : solidPour
      const pourIslands = crossSectionToCopperPourIslands(finalPour)

      brep_shapes_by_region[regionIndex] = generateBRep(pourIslands)
      solvedRegions.push({
        layer: region.layer,
        connectivityKey: region.connectivityKey,
        regionIndex,
        // Reserve the solid region so lower-priority nets cannot fill hatch openings.
        section: solidPour,
      })
    }

    return {
      brep_shapes: brep_shapes_by_region.flat(),
      brep_shapes_by_region,
    }
  }
}
