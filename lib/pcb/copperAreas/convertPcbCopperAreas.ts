import type { PcbConversionContext } from "../model"
import { convertAltiumCopperAreas } from "./convertAltiumCopperAreas"

export function convertPcbCopperAreas(context: PcbConversionContext): void {
  if (context.options.includeCopperAreas === false) return
  context.elements.push(
    ...convertAltiumCopperAreas(context.document, {
      layerMap: context.layerMap,
      copperPourMode: context.options.copperPourMode,
      getSourceNetId: context.netContext.getSourceNetId,
    }),
  )
}
