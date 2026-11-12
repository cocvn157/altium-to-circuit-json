import { type AltiumPcbDocument, getAltiumBounds } from "altiumts"
import type { PcbBoard } from "circuit-json"
import { milsToMillimeters, toMillimeterPoint } from "../geometry"
import type { PcbCopperLayerMap } from "../layers"
import { BOARD_ID, type PcbRoutingConstraints } from "../model"
import { getFallbackPcbBounds } from "./getFallbackPcbBounds"
import { getPcbBoardThickness } from "./getPcbBoardThickness"
import { getPreferredPcbBoardOutline } from "./getPreferredPcbBoardOutline"

export function createBoard({
  document,
  layerMap,
  routingConstraints,
}: {
  document: AltiumPcbDocument
  layerMap: PcbCopperLayerMap
  routingConstraints: PcbRoutingConstraints
}): PcbBoard {
  const altiumOutline = getPreferredPcbBoardOutline(document)
  const outline = altiumOutline.map(toMillimeterPoint)
  const bounds =
    getAltiumBounds(altiumOutline) ?? getFallbackPcbBounds(document.records)
  const width = Math.max(milsToMillimeters(bounds.maxX - bounds.minX), 0.1)
  const height = Math.max(milsToMillimeters(bounds.maxY - bounds.minY), 0.1)

  return {
    type: "pcb_board",
    pcb_board_id: BOARD_ID,
    center: {
      x: milsToMillimeters((bounds.minX + bounds.maxX) / 2),
      y: milsToMillimeters((bounds.minY + bounds.maxY) / 2),
    },
    width,
    height,
    ...(outline.length >= 3 ? { shape: "polygon" as const, outline } : {}),
    thickness: getPcbBoardThickness(document),
    num_layers: layerMap.layers.length,
    material: "fr4",
    ...routingConstraints.pcbBoard,
  }
}
