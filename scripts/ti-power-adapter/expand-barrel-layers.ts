import type { AnyCircuitElement, LayerRef, PcbPort } from "circuit-json"

type PcbPortId = PcbPort["pcb_port_id"]

/** Endpoint layer lists describe a drilled span, including the inner layers. */
export function expandBarrelLayers(elements: AnyCircuitElement[]): AnyCircuitElement[] {
  const board = elements.find(e => e.type === "pcb_board")
  if (!board || board.type !== "pcb_board") throw new Error("Missing board layer stack")
  const stack: LayerRef[] = ["top", ...Array.from({length: Math.max(0, board.num_layers - 2)}, (_, i) => `inner${i + 1}` as LayerRef), "bottom"]
  const portLayers = new Map<PcbPortId, Set<LayerRef>>()
  const expanded = elements.map(element => {
    if (element.type !== "pcb_plated_hole") return element
    const indices = element.layers.map(layer => stack.indexOf(layer))
    if (!indices.length || indices.some(i => i < 0)) throw new Error("Plated-hole layer is outside the physical board stack")
    const layers = stack.slice(Math.min(...indices), Math.max(...indices) + 1)
    if (element.pcb_port_id) {
      const occupied = portLayers.get(element.pcb_port_id) ?? new Set<LayerRef>()
      for (const layer of layers) occupied.add(layer)
      portLayers.set(element.pcb_port_id, occupied)
    }
    return {...element, layers}
  })
  return expanded.map(element => element.type === "pcb_port" && portLayers.has(element.pcb_port_id)
    ? {...element, layers: stack.filter(layer => portLayers.get(element.pcb_port_id)!.has(layer))}
    : element)
}
