import { PrimitiveComponent } from "@tscircuit/core"
import { pcb_keepout } from "circuit-json"
import { z } from "zod"

const importedKeepoutProps = z.object({ keepouts: z.array(pcb_keepout) })

/** Preserve authored keepout paths that the current TSX exporter omits. */
export class ImportedKeepouts extends PrimitiveComponent<typeof importedKeepoutProps> {
  isPcbPrimitive = true

  get config() {
    return {componentName: "ImportedKeepouts", zodProps: importedKeepoutProps}
  }

  doInitialPcbPrimitiveRender(): void {
    if (!this.root || this.root.pcbDisabled) return
    for (const keepout of this._parsedProps.keepouts) {
      if (keepout.pcb_component_id || keepout.excluded_pcb_component_ids?.length) throw new Error("Owned keepouts require an explicit component mapping")
      this.root.db.pcb_keepout.insert({...keepout, subcircuit_id: this.getSubcircuit().subcircuit_id ?? undefined})
    }
  }

  getPcbSize() { return {width: 0, height: 0} }
}
