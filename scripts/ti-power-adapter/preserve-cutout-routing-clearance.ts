import type { SimpleRouteJson } from "@tscircuit/core"
import type { AnyCircuitElement, LayerRef } from "circuit-json"

/** Preserve cutout boundaries in board-world mm: +X right, +Y up, +Z above. */
export function preserveCutoutRoutingClearance(input: {
  srj: SimpleRouteJson
  circuitJson: AnyCircuitElement[]
}): void {
  const cutouts = input.circuitJson.filter(element => element.type === "pcb_cutout" && element.shape === "polygon")
  if (!cutouts.length) return
  const board = input.circuitJson.find(element => element.type === "pcb_board")
  if (!board || board.type !== "pcb_board") throw new Error("Missing cutout board")
  const { minBoardEdgeClearance, minTraceToHoleEdgeClearance } = input.srj
  if (minBoardEdgeClearance === undefined || minTraceToHoleEdgeClearance === undefined) throw new Error("Missing resolved cutout routing clearances")
  // A one-micron boundary remains nondegenerate in the rectangular SRJ model.
  const thickness = 0.001 + 2 * Math.max(0, minBoardEdgeClearance - minTraceToHoleEdgeClearance)
  const layers: LayerRef[] = ["top", ...Array.from({length: board.num_layers - 2}, (_, i) => `inner${i + 1}` as LayerRef), "bottom"]
  for (const cutout of cutouts) {
    if (cutout.type !== "pcb_cutout" || cutout.shape !== "polygon") throw new Error("Expected a polygon cutout")
    for (let index = 0; index < cutout.points.length; index++) {
      const start = cutout.points[index]!, end = cutout.points[(index + 1) % cutout.points.length]!
      if (start.x === end.x && start.y === end.y) continue
      input.srj.obstacles.push({
        obstacleId:`${cutout.pcb_cutout_id}_boundary_${index}`,
        isNonPlatedHole:true, type:"rect", layers,
        center:{x:(start.x+end.x)/2,y:(start.y+end.y)/2},
        width:Math.abs(end.x-start.x)+thickness,
        height:Math.abs(end.y-start.y)+thickness,
        connectedTo:[],
      })
    }
  }
}
