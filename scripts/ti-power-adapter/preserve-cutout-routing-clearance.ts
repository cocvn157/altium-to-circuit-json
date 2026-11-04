import { getSimpleRouteJsonFromCircuitJson, type SimpleRouteJson } from "@tscircuit/core"
import type { AnyCircuitElement, LayerRef } from "circuit-json"

/** Preserve cutout boundaries in board-world mm: +X right, +Y up, +Z above. */
export function preserveCutoutRoutingClearance(input: {
  srj: SimpleRouteJson
  circuitJson: AnyCircuitElement[]
}): void {
  const cutouts = input.circuitJson.filter(
    element => element.type === "pcb_cutout" && element.shape === "polygon",
  )
  if (!cutouts.length) return
  const board = input.circuitJson.find(element => element.type === "pcb_board")
  if (!board || board.type !== "pcb_board") throw new Error("Missing cutout board")
  const { minBoardEdgeClearance, minTraceToHoleEdgeClearance } = input.srj
  if (minBoardEdgeClearance === undefined || minTraceToHoleEdgeClearance === undefined) {
    throw new Error("Missing resolved cutout routing clearances")
  }
  // A one-micron boundary remains nondegenerate in the rectangular SRJ model.
  const thickness =
    0.001 + 2 * Math.max(0, minBoardEdgeClearance - minTraceToHoleEdgeClearance)
  const layers: LayerRef[] = [
    "top",
    ...Array.from(
      { length: board.num_layers - 2 },
      (_, i) => `inner${i + 1}` as LayerRef,
    ),
    "bottom",
  ]
  for (const cutout of cutouts) {
    if (cutout.type !== "pcb_cutout" || cutout.shape !== "polygon") throw new Error("Expected a polygon cutout")
    const first = cutout.points[0]
    const last = cutout.points.at(-1)
    if (!first || !last) throw new Error("Empty cutout outline")
    const outline = [...cutout.points]
    if (first.x !== last.x || first.y !== last.y) outline.push({ ...first })
    const boundaryId = `${cutout.pcb_cutout_id}_routing_boundary`
    // Reuse core's complete-circle detector instead of making one hole per edge.
    const { simpleRouteJson: fitted } = getSimpleRouteJsonFromCircuitJson({
      circuitJson: [board, {
        type: "pcb_keepout", pcb_keepout_id: boundaryId, shape: "outline",
        outline, stroke_width: thickness, layers,
      }],
    })
    const circle = fitted.obstacles.find(obstacle => obstacle.obstacleId === boundaryId)
    if (circle) {
      // Enclose every original vertex, including quantized circular outlines.
      const diameter = thickness + 2 * Math.max(...cutout.points.map(point =>
        Math.hypot(point.x - circle.center.x, point.y - circle.center.y),
      ))
      input.srj.obstacles.push({
        ...circle, shape: "circle", isNonPlatedHole: true,
        width: diameter, height: diameter,
      })
      continue
    }
    for (let index = 0; index < cutout.points.length; index++) {
      const start = cutout.points[index]!
      const end = cutout.points[(index + 1) % cutout.points.length]!
      if (start.x === end.x && start.y === end.y) continue
      input.srj.obstacles.push({
        obstacleId: `${cutout.pcb_cutout_id}_boundary_${index}`,
        isNonPlatedHole: true,
        type: "rect",
        layers,
        center: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
        width: Math.abs(end.x - start.x) + thickness,
        height: Math.abs(end.y - start.y) + thickness,
        connectedTo: [],
      })
    }
  }
}
