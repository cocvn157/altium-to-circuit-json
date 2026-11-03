import { AltiumPadRecord, getAltiumPcbPadGeometry, type AltiumPcbDocument } from "altiumts"
import type { AnyCircuitElement } from "circuit-json"

/** Altium stores the two slot axes independently; either axis can be longer. */
export function preserveSlotDimensions(document: AltiumPcbDocument, elements: AnyCircuitElement[]) {
  const slots = new Map<string, { width: number; height: number }>()
  for (const [index, record] of document.records.entries()) {
    if (!(record instanceof AltiumPadRecord)) continue
    const geometry = getAltiumPcbPadGeometry({ record, useRequestedLayerGeometry: true })
    if (geometry.holeShape !== "SLOT") continue
    if (geometry.slotLengthMils <= 0 || geometry.holeSizeMils <= 0) throw new Error("Invalid authored slot dimensions")
    slots.set(`altium_${index}`, { width: geometry.slotLengthMils * .0254, height: geometry.holeSizeMils * .0254 })
  }
  return elements.map(element => {
    const id = element.type === "pcb_plated_hole" ? element.pcb_plated_hole_id.replace("pcb_plated_hole_", "")
      : element.type === "pcb_hole" ? element.pcb_hole_id.replace("pcb_hole_", "") : undefined
    const slot = id ? slots.get(id) : undefined
    if (!slot || !((element.type === "pcb_plated_hole" || element.type === "pcb_hole") && "hole_width" in element)) return element
    return { ...element, hole_width: slot.width, hole_height: slot.height }
  })
}
