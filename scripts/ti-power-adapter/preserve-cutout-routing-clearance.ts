import { getSimpleRouteJsonFromCircuitJson, type SimpleRouteJson } from "@tscircuit/core"
import type { AnyCircuitElement, LayerRef, PcbKeepoutOutline } from "circuit-json"

/** Preserve cutout boundaries in board-world mm: +X right, +Y up, +Z above. */
export function preserveCutoutRoutingClearance(input: {
  srj: SimpleRouteJson
  circuitJson: AnyCircuitElement[]
}): void {
  const cutouts = input.circuitJson.filter(element => element.type === "pcb_cutout" && element.shape === "polygon")
  if (!cutouts.length) return
  const board = input.circuitJson.find(element => element.type === "pcb_board")
  if (!board || board.type !== "pcb_board") throw new Error("Missing cutout board")
  const { minBoardEdgeClearance, minTraceToHoleEdgeClearance, minTraceToPadEdgeClearance, minPadEdgeToPadEdgeClearance } = input.srj
  if ([minBoardEdgeClearance, minTraceToHoleEdgeClearance, minTraceToPadEdgeClearance, minPadEdgeToPadEdgeClearance].some(value => value === undefined || !Number.isFinite(value) || value < 0)) {
    throw new Error("Missing resolved cutout routing clearances")
  }
  const requiredGap = Math.max(minBoardEdgeClearance!, minTraceToHoleEdgeClearance!)
  const ordinaryGap = Math.min(minTraceToPadEdgeClearance!, minPadEdgeToPadEdgeClearance!)
  // Ordinary obstacle clearance supplies the rest of the required gap.
  const strokeWidth = 2 * Math.max(requiredGap - ordinaryGap, 1e-6)
  const layers: LayerRef[] = ["top", ...Array.from({length: board.num_layers - 2}, (_, i) => `inner${i + 1}` as LayerRef), "bottom"]
  const boundaries: PcbKeepoutOutline[] = cutouts.map(cutout => {
    if (cutout.type !== "pcb_cutout" || cutout.shape !== "polygon") throw new Error("Expected a polygon cutout")
    const outline = [...cutout.points]
    const first = outline[0], last = outline.at(-1)
    if (!first || !last) throw new Error("Empty cutout outline")
    if (first.x !== last.x || first.y !== last.y) outline.push({...first})
    return {type:"pcb_keepout",pcb_keepout_id:`${cutout.pcb_cutout_id}_routing_boundary`,shape:"outline",outline,stroke_width:strokeWidth,layers}
  })
  const { simpleRouteJson } = getSimpleRouteJsonFromCircuitJson({circuitJson:[board, ...boundaries]})
  input.srj.obstacles.push(...simpleRouteJson.obstacles)
}
