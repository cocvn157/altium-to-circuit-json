import type { AnyCircuitElement, LayerRef, PcbCopperPour, SourceNet } from "circuit-json"
import { getElementId } from "@tscircuit/circuit-json-util"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { getCopperPourOutline } from "tsx-source/get-copper-pour-outline"
import { buildSubcircuitConnectivityLookup } from "./solver/lib/circuit-json/buildSubcircuitConnectivityLookup"
import { convertCircuitJsonToInputProblem, CopperPourPipelineSolver, initializeManifoldGeometry } from "./solver/lib/index"
import type { InputPad, InputPourRegion } from "./solver/lib/types"
import type { CopperIdentity } from "./types"
import type { PourDefinition } from "./read-board"
import type { RuleResolver } from "./rules/RuleResolver"

export async function computePours(input: {
  circuitJson: AnyCircuitElement[]
  definitions: PourDefinition[]
  runtimeNames: ReadonlyMap<string, string>
  originalNetNames: ReadonlyMap<string, string>
  rules: RuleResolver
}) {
  const { circuitJson, definitions, runtimeNames, originalNetNames, rules } = input
  const board = circuitJson.find(e => e.type === "pcb_board")
  if (!board || board.type !== "pcb_board" || !board.outline?.length) throw new Error("Missing physical board outline")
  const subcircuit = board.subcircuit_id
  const connectivity = buildSubcircuitConnectivityLookup(circuitJson, getFullConnectivityMapFromCircuitJson(circuitJson), subcircuit)
  const sourceNets = circuitJson.filter((e): e is SourceNet => e.type === "source_net")
  const netsByName = new Map(sourceNets.map(e => [e.name, e]))
  const elements = new Map(circuitJson.map(e => [getElementId(e), e]))
  const originalNameByRuntime = new Map<string, string>()
  for (const [id, name] of originalNetNames) originalNameByRuntime.set(runtimeNames.get(id) ?? name, name)
  const originalNetByKey = new Map<string, string>()
  for (const net of sourceNets) {
    const key = connectivity.getSubcircuitConnectivityKeyForId(net.source_net_id)
    if (key) originalNetByKey.set(key, originalNameByRuntime.get(net.name) ?? net.name)
  }
  const resolved = definitions.map(definition => {
    const { copper, identity } = definition
    const runtimeName = copper.source_net_id ? runtimeNames.get(copper.source_net_id) ?? identity.netName : `__circuit_json_unassigned_${copper.pcb_copper_pour_id}`
    const net = runtimeName ? netsByName.get(runtimeName) : undefined
    const connectivityKey = net ? connectivity.getSubcircuitConnectivityKeyForId(net.source_net_id) : `unconnected-pour:${copper.pcb_copper_pour_id}`
    if (copper.source_net_id && (!net || !connectivityKey)) throw new Error(`Authored pour net missing from core output: ${runtimeName}`)
    const outline = getCopperPourOutline(copper)
    if (!outline || outline.length < 3) throw new Error("Unsupported authored copper outline")
    const edge = definition.fixed ? 0 : rules.boardEdge(identity)
    const region: InputPourRegion = {
      shape: "rect", layer: copper.layer, connectivityKey: connectivityKey!, outline,
      bounds: { minX: Math.min(...outline.map(p => p.x)), maxX: Math.max(...outline.map(p => p.x)), minY: Math.min(...outline.map(p => p.y)), maxY: Math.max(...outline.map(p => p.y)) },
      padMargin: 0, traceMargin: 0, pourMargin: 0,
      board_edge_margin: edge, cutout_margin: edge,
      boardEdgeOutline: board.outline, boardOutline: board.outline,
      use_thermal_reliefs: false,
    }
    return { definition, region, net }
  })
  // Extract pads once per layer instead of rebuilding their connectivity for every pour.
  const pads: InputPad[] = []
  for (const layer of new Set(resolved.map(r => r.definition.copper.layer))) {
    const net = sourceNets[0]
    if (!net) throw new Error("No source nets in rendered board")
    pads.push(...convertCircuitJsonToInputProblem(circuitJson, {
      layer, subcircuit_id: subcircuit, source_net_id: net.source_net_id,
      pad_margin: 0, trace_margin: 0, outline: board.outline,
    }).pads)
  }
  const identityForPad = (pad: InputPad): CopperIdentity => {
    const element = elements.get(pad.padId)
    const via = element?.type === "pcb_via"
    const hole = pad.connectivityKey.startsWith("hole:")
    const trace = pad.shape === "trace" || pad.shape === "tapered_trace"
    const componentId = element && "pcb_component_id" in element ? element.pcb_component_id : undefined
    const component = componentId ? elements.get(componentId) : undefined
    const sourceComponent = component?.type === "pcb_component" ? elements.get(component.source_component_id) : undefined
    return {
      objectType: hole ? "hole" : via ? "via" : trace ? "trace" : pad.isPlatedHole ? "plated_hole" : "smtpad",
      matrixKind: hole ? "Hole" : via ? "Via" : trace ? "Track" : pad.isPlatedHole ? "THPad" : "SMDPad",
      layer: pad.layer as LayerRef, netName: originalNetByKey.get(pad.connectivityKey),
      componentName: sourceComponent?.type === "source_component" ? sourceComponent.name : undefined,
      isFree: !component,
    }
  }
  const identities = new Map(pads.map(pad => [pad, identityForPad(pad)]))
  await initializeManifoldGeometry()
  const solver = new CopperPourPipelineSolver({ pads, regionsForPour: resolved.map(r => r.region) }, {
    fixedRegions: new Set(resolved.flatMap((r, i) => r.definition.fixed ? [i] : [])),
    padClearance: ({ regionIndex, pad }) => {
      if (/^(cutout|keepout):/u.test(pad.connectivityKey)) return undefined
      return rules.clearance(resolved[regionIndex]!.definition.identity, identities.get(pad)!)
    },
    pourClearance: ({ regionIndex, otherRegionIndex }) => rules.clearance(resolved[regionIndex]!.definition.identity, resolved[otherRegionIndex]!.definition.identity),
  })
  const output = solver.getOutput()
  const pours: PcbCopperPour[] = resolved.flatMap((r, regionIndex) => {
    const metadata = { source_net_id: r.net?.source_net_id, subcircuit_id: subcircuit }
    // Keep authored fills/regions exactly; only polygon definitions are recomputed.
    if (r.definition.fixed) return [{ ...r.definition.copper, ...metadata }]
    return output.brep_shapes_by_region[regionIndex]!.map((shape, island) => ({
      type: "pcb_copper_pour" as const, shape: "brep" as const,
      pcb_copper_pour_id: `${r.definition.copper.pcb_copper_pour_id}_computed_${island}`,
      layer: r.definition.copper.layer, brep_shape: shape,
      covered_with_solder_mask: r.definition.copper.covered_with_solder_mask, ...metadata,
    }))
  })
  return { circuitJson: [...circuitJson.filter(e => e.type !== "pcb_copper_pour"), ...pours], pours, definitions: resolved.length, fixed: resolved.filter(r => r.definition.fixed).length }
}
