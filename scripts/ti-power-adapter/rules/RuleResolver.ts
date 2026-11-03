import type { AltiumPcbDocument, AltiumRuleRecord } from "altiumts"
import { PcbCopperLayerMap } from "altium-source/pcb/layers"
import type { CopperIdentity } from "../types"
import type { AltiumClearanceObject, AltiumClearanceQuery } from "./AltiumClearanceQuery"
import { parseAltiumClearanceQuery } from "./parseAltiumClearanceQuery"
import { matchesAltiumClearanceQuery } from "./matchesAltiumClearanceQuery"
import { getAltiumNetClassNames } from "./getAltiumNetClassNames"
import { getAltiumComponentClassNames } from "./getAltiumComponentClassNames"

type ClearancePairKey = string
type NativeNetName = string
type NativeComponentName = string
type NativeClassName = string
interface CompiledRule {
  record: AltiumRuleRecord
  first: AltiumClearanceQuery
  second: AltiumClearanceQuery
  matrix: Record<string, number>
}

/** Resolve only the query subset present in these boards; reject unknown syntax. */
export class RuleResolver {
  private readonly layerMap
  private readonly rules: CompiledRule[]
  private readonly netClasses = new Map<NativeNetName, ReadonlySet<NativeClassName>>()
  private readonly componentClasses = new Map<NativeComponentName, ReadonlySet<NativeClassName>>()
  private readonly cache = new Map<ClearancePairKey, number>()

  constructor(private readonly document: AltiumPcbDocument) {
    this.layerMap = new PcbCopperLayerMap(document)
    this.rules = this.getRules("CLEARANCE").map(record => {
      const matrix: Record<string, number> = {}
      for (const entry of (record.get("OBJECTCLEARANCES") ?? "").split(";").filter(Boolean)) {
        const match = /^ClearanceObj_(\w+)-ClearanceObj_(\w+):([\d.eE+-]+)$/u.exec(entry)
        const value = Number(match?.[3])
        if (!match || !Number.isFinite(value) || value < 0) throw new Error("Unsupported Altium clearance matrix")
        matrix[`${match[1]}:${match[2]}`] = value / 10000
      }
      return { record, matrix, first: parseAltiumClearanceQuery(record.scope1Expression), second: parseAltiumClearanceQuery(record.scope2Expression) }
    })
  }

  private getRules(kind: string): AltiumRuleRecord[] {
    return this.document.rules.filter(rule => rule.enabled !== false && rule.ruleKind?.toUpperCase() === kind)
      .sort((a, b) => (a.priority ?? Infinity) - (b.priority ?? Infinity))
  }

  private object(identity: CopperIdentity): AltiumClearanceObject {
    const net = identity.netName ?? ""
    const component = identity.componentName ?? ""
    if (!this.netClasses.has(net)) this.netClasses.set(net, getAltiumNetClassNames(this.document, identity.netName))
    if (!this.componentClasses.has(component)) this.componentClasses.set(component, getAltiumComponentClassNames(this.document, identity.componentName))
    return { ...identity, layerMap: this.layerMap, netClasses: this.netClasses.get(net)!, componentClasses: this.componentClasses.get(component)! }
  }

  clearance(source: CopperIdentity, target: CopperIdentity): number {
    const key = JSON.stringify([source, target])
    const cached = this.cache.get(key)
    if (cached !== undefined) return cached
    const first = this.object(source), second = this.object(target)
    for (const rule of this.rules) {
      if (!((matchesAltiumClearanceQuery(rule.first, first) && matchesAltiumClearanceQuery(rule.second, second)) ||
          (matchesAltiumClearanceQuery(rule.second, first) && matchesAltiumClearanceQuery(rule.first, second)))) continue
      const scope = rule.record.get("NETSCOPE")?.toUpperCase()
      const layerKind = rule.record.get("LAYERKIND")?.toUpperCase()
      if (scope && scope !== "DIFFERENTNETS") throw new Error(`Unsupported relevant net scope ${scope}`)
      if (layerKind && layerKind !== "SAMELAYER") throw new Error(`Unsupported relevant layer scope ${layerKind}`)
      const mils = rule.matrix[`${source.matrixKind}:${target.matrixKind}`] ??
        rule.matrix[`${target.matrixKind}:${source.matrixKind}`] ?? rule.record.clearanceMils
      if (mils === undefined || !Number.isFinite(mils) || mils < 0) throw new Error("Missing valid Altium copper clearance")
      const gap = mils * 0.0254
      this.cache.set(key, gap)
      return gap
    }
    throw new Error("No applicable Altium copper clearance rule")
  }

  boardEdge(source: CopperIdentity): number {
    const object = this.object(source)
    for (const rule of this.getRules("BOARDOUTLINECLEARANCE")) {
      if (!matchesAltiumClearanceQuery(parseAltiumClearanceQuery(rule.scope1Expression), object)) continue
      const gap = rule.clearanceMils
      if (gap === undefined || !Number.isFinite(gap) || gap < 0) throw new Error("Missing valid board-edge clearance")
      return gap * 0.0254
    }
    return 0
  }
}
