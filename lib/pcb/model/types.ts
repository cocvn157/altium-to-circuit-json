import type {
  AltiumEmbeddedModel,
  AltiumPadRecord,
  AltiumPcbDocument,
  AltiumPrjPcb,
  AltiumRecord,
} from "altiumts"
import type {
  AnyCircuitElement,
  PcbBoard,
  SourceNet,
  SourcePort,
  SourceSimpleChip,
  SourceTrace,
} from "circuit-json"
import type { PcbCopperLayerMap } from "../layers"

export interface EmbeddedModelUrlContext {
  embeddedModel: AltiumEmbeddedModel
}

export interface ConvertAltiumPcbDocOptions {
  idPrefix?: string
  includeBoardOutline?: boolean
  includeCadModels?: boolean
  includeComponents?: boolean
  includeCopperAreas?: boolean
  /** Import polygon definitions for repouring in core; this converter does not run a pour solver. */
  copperPourMode?: "preserve" | "recompute"
  includeCourtyards?: boolean
  includeDimensions?: boolean
  includeKeepouts?: boolean
  includePads?: boolean
  includeSilkscreen?: boolean
  includeTraces?: boolean
  includeVias?: boolean
  resolveEmbeddedModelUrl?: (
    context: EmbeddedModelUrlContext,
  ) => string | undefined
  project?: AltiumPrjPcb
}

export interface PcbNetContext {
  elements: Array<SourceNet | SourceTrace>
  getSourceNetId: (record: AltiumRecord) => string | undefined
  getSourceTraceId: (record: AltiumRecord) => string | undefined
}

export interface PcbComponentContext {
  sourceComponents: SourceSimpleChip[]
  sourcePorts: SourcePort[]
  getPcbComponentId: (record: AltiumRecord) => string | undefined
  getSourcePortId: (record: AltiumPadRecord) => string | undefined
}

export interface PcbRoutingConstraints {
  pcbBoard: Pick<
    PcbBoard,
    | "allow_blind_and_buried_vias"
    | "is_via_in_pad_allowed"
    | "min_trace_width"
    | "min_board_edge_clearance"
    | "min_trace_to_pad_edge_clearance"
    | "min_different_net_trace_edge_to_trace_edge_clearance"
    | "min_pad_edge_to_pad_edge_clearance"
    | "min_via_edge_to_pad_edge_clearance"
    | "min_via_hole_diameter"
    | "min_via_pad_diameter"
  >
  sourceNetTraceWidthMillimeters?: number
}

export interface PcbConversionContext {
  componentContext: PcbComponentContext
  document: AltiumPcbDocument
  elements: AnyCircuitElement[]
  layerMap: PcbCopperLayerMap
  netContext: PcbNetContext
  options: ConvertAltiumPcbDocOptions
  routingConstraints: PcbRoutingConstraints
}
