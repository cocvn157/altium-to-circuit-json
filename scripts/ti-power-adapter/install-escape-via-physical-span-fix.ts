import { createRequire } from "node:module"
import { AutoroutingPipelineSolver } from "@tscircuit/capacity-autorouter"

type EscapeSolver = {
  ogSrj: { layerCount: number; allowBlindAndBuriedVias?: boolean }
}
type ClearanceParameters = {
  candidate: { x: number; y: number }
  connectionNetIds: Set<string>
  sourceZ: number
  targetZ: number
}
type EscapePrototype = {
  getViaSpanLayers: (this: EscapeSolver, source: string, target: string) => {
    layers: string[]
    __zLayers: number[]
  }
  getMinBlockingClearance: (this: EscapeSolver, parameters: ClearanceParameters) => number
}

// Temporary adapter for the existing solver in the pinned release. Through
// vias drill every layer, including layers beyond their routed destination.
export function installEscapeViaPhysicalSpanFix(): void {
  const version = createRequire(import.meta.url)("@tscircuit/capacity-autorouter/package.json").version
  if (version !== "0.0.1035") throw new Error(`Recheck escape-via patch for autorouter ${version}`)
  const pipeline = new AutoroutingPipelineSolver({
    layerCount: 2, minTraceWidth: 0.1, obstacles: [], connections: [],
    bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
  }, { cacheProvider: null })
  const stage = pipeline.pipelineDef.find(step => step.solverName === "escapeViaLocationSolver")
  if (!stage?.solverClass) throw new Error("Missing escape-via stage in pinned autorouter")
  const prototype = stage.solverClass.prototype as EscapePrototype
  const span = prototype.getViaSpanLayers
  const clearance = prototype.getMinBlockingClearance
  if (typeof span !== "function" || typeof clearance !== "function") {
    throw new Error("Escape-via methods changed in pinned autorouter")
  }
  prototype.getViaSpanLayers = function(source, target) {
    return this.ogSrj.allowBlindAndBuriedVias === true
      ? span.call(this, source, target)
      : span.call(this, "top", "bottom")
  }
  prototype.getMinBlockingClearance = function(parameters) {
    if (this.ogSrj.allowBlindAndBuriedVias === true) {
      return clearance.call(this, parameters)
    }
    // Retain sourceZ: it also distinguishes source-layer copper pours.
    return Math.min(
      clearance.call(this, { ...parameters, targetZ: 0 }),
      clearance.call(this, { ...parameters, targetZ: this.ogSrj.layerCount - 1 }),
    )
  }
}
