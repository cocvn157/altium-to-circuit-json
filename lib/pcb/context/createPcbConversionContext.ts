import type { AltiumPcbDocument } from "altiumts"
import { PcbCopperLayerMap } from "../layers"
import type { ConvertAltiumPcbDocOptions, PcbConversionContext } from "../model"
import { getPcbRoutingConstraints } from "../routing/getPcbRoutingConstraints"
import { createPcbComponentContext } from "./createPcbComponentContext"
import { createPcbNetContext } from "./createPcbNetContext"

export function createPcbConversionContext({
  document,
  options,
}: {
  document: AltiumPcbDocument
  options: ConvertAltiumPcbDocOptions
}): PcbConversionContext {
  const layerMap = new PcbCopperLayerMap(document)
  const componentContext = createPcbComponentContext({
    document,
    includePorts: options.includePads !== false,
    layerMap,
  })
  const routingConstraints = getPcbRoutingConstraints({
    document,
    layerMap,
    copperPourMode:
      options.includeCopperAreas === false
        ? "preserve"
        : options.copperPourMode,
  })
  return {
    componentContext,
    document,
    elements: [],
    layerMap,
    netContext: createPcbNetContext({
      componentContext,
      document,
      sourceNetTraceWidthMillimeters:
        routingConstraints.sourceNetTraceWidthMillimeters,
    }),
    options,
    routingConstraints,
  }
}
