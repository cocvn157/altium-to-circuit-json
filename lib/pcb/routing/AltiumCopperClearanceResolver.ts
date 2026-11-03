import {
  AltiumFillRecord,
  AltiumPolygonRecord,
  type AltiumRegionRecord,
  type AltiumPcbDocument,
  type AltiumRecord,
} from "altiumts"
import {
  copper_pour_clearance_object_type,
  type CopperPourClearanceProperties,
  type CopperPourClearanceRule,
} from "circuit-json"
import type { PcbCopperLayerMap } from "../layers"
import type { AltiumClearanceObject } from "./AltiumClearanceQuery"
import type { AltiumCopperMatrixKind } from "./AltiumCopperClearanceRule"
import { getAltiumCopperClearanceRules } from "./getAltiumCopperClearanceRules"
import { resolveAltiumCopperClearanceGap } from "./resolveAltiumCopperClearanceGap"
import { getApplicableAltiumCopperRules } from "./getApplicableAltiumCopperRules"
import { getAltiumNetClassNames } from "./getAltiumNetClassNames"
import { getAltiumComponentClassNames } from "./getAltiumComponentClassNames"
import { getAltiumCopperBoardEdgeMargin } from "./getAltiumCopperBoardEdgeMargin"

type CopperClearanceScopeKey = string

export class AltiumCopperClearanceResolver {
  private readonly rules
  private readonly nets
  private readonly cache = new Map<
    CopperClearanceScopeKey,
    CopperPourClearanceProperties
  >()

  constructor(
    private readonly context: {
      document: AltiumPcbDocument
      layerMap: PcbCopperLayerMap
      getSourceNetId: (record: AltiumRecord) => string | undefined
    },
  ) {
    this.rules = getAltiumCopperClearanceRules(context.document)
    this.nets = context.document.nets.map((net) => ({
      net,
      sourceNetId: context.getSourceNetId(net),
      classes: getAltiumNetClassNames(context.document, net.name),
    }))
  }

  getProperties(
    record: AltiumPolygonRecord | AltiumFillRecord | AltiumRegionRecord,
  ): CopperPourClearanceProperties {
    const { document, layerMap, getSourceNetId } = this.context
    const layer = layerMap.getLayer(record.layer)
    if (!layer) return {}
    const net = document.getNetForRecord(record)
    const isStatic = !(record instanceof AltiumPolygonRecord)
    const sourceKind: AltiumCopperMatrixKind =
      record instanceof AltiumPolygonRecord
        ? "Poly"
        : record instanceof AltiumFillRecord
          ? "Fill"
          : "Region"
    const component = document.getComponentForRecord(record)
    const key: CopperClearanceScopeKey = `${sourceKind}:${net?.name ?? ""}:${layer}:${component?.designator ?? ""}`
    const cached = this.cache.get(key)
    if (cached) return cached
    const source: AltiumClearanceObject = {
      objectType: isStatic ? "copper_region" : "copper_pour",
      layer,
      layerMap,
      netName: net?.name,
      netClasses: getAltiumNetClassNames(document, net?.name),
      componentClasses: getAltiumComponentClassNames(
        document,
        component?.designator,
      ),
      isFree: !component,
    }
    const rules = getApplicableAltiumCopperRules(this.rules, source)
    const clearance = resolveAltiumCopperClearanceGap({
      rules,
      sourceKind,
      target: {
        ...source,
        objectType: "trace",
        netName: undefined,
        netClasses: new Set(),
        componentClasses: undefined,
        isFree: true,
      },
    })
    const overrides: CopperPourClearanceRule[] = []
    for (const targetType of copper_pour_clearance_object_type.options) {
      const target: AltiumClearanceObject = {
        ...source,
        objectType: targetType,
        netName: undefined,
        netClasses: new Set(),
        componentClasses: undefined,
        isFree: targetType !== "smtpad" && targetType !== "plated_hole",
      }
      const unconnectedGap = resolveAltiumCopperClearanceGap({
        rules,
        sourceKind,
        target,
      })
      for (const targetNet of this.nets) {
        if (targetNet.net === net) continue
        const gap = resolveAltiumCopperClearanceGap({
          rules,
          sourceKind,
          target: {
            ...target,
            netName: targetNet.net.name,
            netClasses: targetNet.classes,
          },
        })
        if (gap === unconnectedGap) continue
        if (!targetNet.sourceNetId)
          throw new Error(
            "Net identities are required to preserve scoped copper clearances",
          )
        const existing = overrides.find(
          (rule) =>
            rule.clearance === gap && rule.object_types?.[0] === targetType,
        )
        if (existing) existing.source_net_ids!.push(targetNet.sourceNetId)
        else
          overrides.push({
            clearance: gap,
            source_net_ids: [targetNet.sourceNetId],
            object_types: [targetType],
          })
      }
      // A final all-net rule covers unconnected copper without masking net exceptions.
      if (unconnectedGap !== clearance)
        overrides.push({
          clearance: unconnectedGap,
          object_types: [targetType],
        })
    }
    const properties: CopperPourClearanceProperties = {
      clearance,
      clearance_rules: overrides,
      board_edge_margin: isStatic
        ? 0
        : getAltiumCopperBoardEdgeMargin(document, source),
      ...(isStatic ? { is_static: true } : {}),
    }
    if (getSourceNetId(record) || !net) this.cache.set(key, properties)
    return properties
  }
}
