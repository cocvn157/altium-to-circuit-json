import type { AnyCircuitElement, LayerRef } from "circuit-json"

/** Endpoint layer lists describe a drilled span, including the inner layers. */
export function expandBarrelLayers(elements: AnyCircuitElement[]): AnyCircuitElement[] {
  const board = elements.find(e => e.type === "pcb_board")
  if (!board || board.type !== "pcb_board") throw new Error("Missing board layer stack")
  const stack: LayerRef[] = ["top", ...Array.from({length: Math.max(0, board.num_layers - 2)}, (_, i) => `inner${i + 1}` as LayerRef), "bottom"]
  return elements.map(element => {
    if (element.type !== "pcb_plated_hole") return element
    const indices = element.layers.map(layer => stack.indexOf(layer))
    if (!indices.length || indices.some(i => i < 0)) throw new Error("Plated-hole layer is outside the physical board stack")
    const layers = stack.slice(Math.min(...indices), Math.max(...indices) + 1)
    return {...element, layers}
  })
}
