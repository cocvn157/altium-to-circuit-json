import type { AnyCircuitElement, SourcePort } from "circuit-json"

type SourcePortId = SourcePort["source_port_id"]

/** Give every physical pad a selectable TSX terminal on its original net. */
export function expandSharedPadPorts(elements: AnyCircuitElement[]): AnyCircuitElement[] {
  const sourcePorts = new Map(elements.filter(e => e.type === "source_port").map(e => [e.source_port_id, e]))
  const copies = new Map<SourcePortId, SourcePort[]>()
  const replacement = new Map<string, SourcePort>()
  const seen = new Set<SourcePortId>()
  for (const element of elements) {
    if (element.type !== "pcb_port") continue
    if (!seen.has(element.source_port_id)) { seen.add(element.source_port_id); continue }
    const original = sourcePorts.get(element.source_port_id)
    if (!original) throw new Error("Missing shared pad's source port")
    const name = `physical_${element.pcb_port_id}`
    const copy: SourcePort = { ...original, source_port_id: `${original.source_port_id}_${name}`, name, pin_number: undefined, port_hints: [name] }
    replacement.set(element.pcb_port_id, copy)
    copies.set(original.source_port_id, [...(copies.get(original.source_port_id) ?? []), copy])
  }
  return [...elements.map(element => {
    if (element.type === "source_trace") return { ...element, connected_source_port_ids: element.connected_source_port_ids.flatMap(id => [id, ...(copies.get(id) ?? []).map(port => port.source_port_id)]) }
    if (element.type === "pcb_port") {
      const copy = replacement.get(element.pcb_port_id)
      return copy ? { ...element, source_port_id: copy.source_port_id } : element
    }
    if ((element.type === "pcb_smtpad" || element.type === "pcb_plated_hole") && element.pcb_port_id) {
      const copy = replacement.get(element.pcb_port_id)
      return copy ? { ...element, port_hints: [copy.name] } : element
    }
    return element
  }), ...[...copies.values()].flat()]
}
