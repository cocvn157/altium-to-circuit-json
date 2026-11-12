import type { AltiumPcbDocument } from "altiumts"
import type { LayerRef } from "circuit-json"
import { INNER_LAYERS } from "./constants"
import { getAltiumPcbLayerDisplayName } from "./getAltiumPcbLayerDisplayName"
import { getCopperLayerIdentity } from "./getCopperLayerIdentity"
import { getCopperStackEntryKeys } from "./getCopperStackEntryKeys"
import { getOrderedCopperStackEntries } from "./getOrderedCopperStackEntries"
import { normalizeLayer } from "./normalizeLayer"

export class PcbCopperLayerMap {
  readonly layers: LayerRef[]
  private readonly mappings: Array<{
    displayName: string
    keys: string[]
    layer: LayerRef
  }> = []

  constructor(document: AltiumPcbDocument) {
    const entries = getOrderedCopperStackEntries(document)
    if (entries.length > INNER_LAYERS.length + 2) {
      throw new Error(
        `Board has ${entries.length} copper layers; Circuit JSON supports at most ${INNER_LAYERS.length + 2}`,
      )
    }
    if (entries.length === 0) {
      this.layers = ["top", "bottom"]
      this.mappings.push(
        { displayName: "Top Layer", keys: ["TOP"], layer: "top" },
        { displayName: "Bottom Layer", keys: ["BOTTOM"], layer: "bottom" },
      )
      return
    }
    if (entries.length < 2)
      throw new Error("Copper board stack must have two outer layers")
    this.layers = [
      "top",
      ...INNER_LAYERS.slice(0, entries.length - 2),
      "bottom",
    ]
    for (const [index, entry] of entries.entries()) {
      const layer = this.layers[index]
      if (!layer) throw new Error("Unsupported copper board stack position")
      const keys = getCopperStackEntryKeys(entry)
      if (
        keys.includes("TOP") !== (layer === "top") ||
        keys.includes("BOTTOM") !== (layer === "bottom")
      ) {
        throw new Error("Copper board stack outer layers are out of order")
      }
      for (const key of keys) {
        if (this.mappings.some((mapping) => mapping.keys.includes(key))) {
          throw new Error(
            `Ambiguous copper layer ${JSON.stringify(key)} in board stack`,
          )
        }
      }
      const displayName =
        entry.name?.trim() || getAltiumPcbLayerDisplayName(entry.layerId)
      if (!displayName) throw new Error("Copper board stack layer has no name")
      this.mappings.push({ displayName, keys, layer })
    }
  }

  getLayer(layer: string | undefined): LayerRef | undefined {
    const identity = getCopperLayerIdentity(layer)
    const key = identity ?? normalizeLayer(layer)
    const mapped = this.mappings.find((mapping) => mapping.keys.includes(key))
    if (mapped) return mapped.layer
    if (identity) {
      throw new Error(
        `Cannot map copper layer ${JSON.stringify(layer)}: it is absent from the board stack`,
      )
    }
    return undefined
  }

  getDisplayName(layer: string | undefined): string | undefined {
    const identity = getCopperLayerIdentity(layer)
    const key = identity ?? normalizeLayer(layer)
    return this.mappings.find((mapping) => mapping.keys.includes(key))
      ?.displayName
  }

  getAltiumPadStackLayer(layer: LayerRef): string {
    const mapping = this.mappings.find((candidate) => candidate.layer === layer)
    if (!mapping) {
      throw new Error(`Cannot map Circuit JSON copper layer ${layer} to Altium`)
    }
    const identity = mapping.keys
      .map((key) => getCopperLayerIdentity(key))
      .find((key) => key !== undefined)
    if (identity === "TOP" || identity === "BOTTOM") return identity
    if (identity?.startsWith("MID")) {
      return `MID-LAYER${identity.slice("MID".length)}`
    }
    if (identity?.startsWith("PLANE")) {
      return `INTERNAL-PLANE${identity.slice("PLANE".length)}`
    }
    const layerIndex = this.layers.indexOf(layer)
    return `MID-LAYER${layerIndex}`
  }
}
