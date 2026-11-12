import { expect, test } from "bun:test"
import {
  AltiumFillRecord,
  AltiumPadRecord,
  type AltiumPcbDocument,
  AltiumPolygonRecord,
  AltiumRegionRecord,
  getPcbRecordComponent,
  parseAltiumBinaryPcbDoc,
} from "altiumts"
import { convertAltiumPcbDocToCircuitJson } from "../../lib"
import type { PcbPlatedHoleWithPadStack } from "../../lib/pcb/pads"
import { readReferenceBytes } from "../helpers/read-reference"

const boardThicknesses = [
  ["ti-pmp23595.PcbDoc", 2.2284944],
  ["ti-pmp23653-main.PcbDoc", 1.56015944],
  ["ti-pmp23653-planar-transformer.PcbDoc", 2.13195916],
  ["ti-pmp22650-main.PcbDoc", 2.27076],
  ["ti-pmp22712.PcbDoc", 0.93531944],
  ["ti-pmp22773.PcbDoc", 1.8073624],
] as const

const pmp22650InnerLayers = [
  "inner1",
  "inner2",
  "inner3",
  "inner4",
  "inner5",
  "inner6",
] as const

const tiPcbReferences = boardThicknesses.map(([filename]) => filename)

const convertedReferenceCache = new Map<
  string,
  Promise<{
    document: AltiumPcbDocument
    circuit: ReturnType<typeof convertAltiumPcbDocToCircuitJson>
  }>
>()

function getConvertedReference(filename: string) {
  let cached = convertedReferenceCache.get(filename)
  if (!cached) {
    cached = readReferenceBytes(filename).then((bytes) => {
      const document = parseAltiumBinaryPcbDoc(bytes)
      return {
        document,
        circuit: convertAltiumPcbDocToCircuitJson(document),
      }
    })
    convertedReferenceCache.set(filename, cached)
  }
  return cached
}

for (const [filename, expectedThickness] of boardThicknesses) {
  test(
    `preserves ${filename} physical board thickness`,
    async () => {
      const { circuit } = await getConvertedReference(filename)
      const board = circuit.find((element) => element.type === "pcb_board")

      expect(board?.thickness).toBeCloseTo(expectedThickness, 7)
    },
    { timeout: 60_000 },
  )
}

test(
  "preserves PMP22650 MP1 pin 1 outer and inner pad sizes",
  async () => {
    const { document, circuit } = await getConvertedReference(
      "ti-pmp22650-main.PcbDoc",
    )
    const pad = getConvertedPad({
      document,
      circuit,
      designator: "MP1",
      pinName: "1",
    })

    expect(pad.layers).toEqual([
      "top",
      "inner1",
      "inner2",
      "inner3",
      "inner4",
      "inner5",
      "inner6",
      "bottom",
    ])
    expect(pad.pad_stack).toEqual([
      {
        layer: "top",
        shape: "rect",
        width: expect.closeTo(7),
        height: expect.closeTo(7),
        corner_radius: expect.closeTo(0.035),
      },
      ...pmp22650InnerLayers.map((layer) => ({
        layer,
        shape: "circle" as const,
        radius: expect.closeTo(2.54),
      })),
      {
        layer: "bottom",
        shape: "rect",
        width: expect.closeTo(7),
        height: expect.closeTo(7),
        corner_radius: expect.closeTo(0.035),
      },
    ])
  },
  { timeout: 60_000 },
)

test(
  "preserves PMP22773 J1 pin 1 layer-specific pad shapes",
  async () => {
    const { document, circuit } =
      await getConvertedReference("ti-pmp22773.PcbDoc")
    const pad = getConvertedPad({
      document,
      circuit,
      designator: "J1",
      pinName: "1",
    })

    expect(
      pad.pad_stack?.map(({ layer, shape }) => ({ layer, shape })),
    ).toEqual([
      { layer: "top", shape: "rect" },
      { layer: "inner1", shape: "rect" },
      { layer: "inner2", shape: "rect" },
      { layer: "bottom", shape: "rect" },
    ])
    for (const layerPad of pad.pad_stack ?? []) {
      if (layerPad.shape !== "rect") throw new Error("Expected rectangular pad")
      expect(layerPad.width).toBeCloseTo(1.65, 5)
      expect(layerPad.height).toBeCloseTo(1.65, 5)
      if (layerPad.layer === "top") {
        expect(layerPad.corner_radius).toBeCloseTo(0.0495, 5)
      } else {
        expect(layerPad.corner_radius).toBeUndefined()
      }
    }
  },
  { timeout: 60_000 },
)

test(
  "preserves all TI copper arcs and via net ownership",
  async () => {
    let copperArcCount = 0
    let netCopperArcCount = 0
    let netViaCount = 0
    for (const filename of tiPcbReferences) {
      const { circuit } = await getConvertedReference(filename)
      const copperArcs = circuit
        .filter((element) => element.type === "pcb_trace")
        .filter((trace) =>
          trace.pcb_trace_id.startsWith("pcb_trace_altium_arc_"),
        )
      const vias = circuit.filter((element) => element.type === "pcb_via")
      copperArcCount += copperArcs.length
      netCopperArcCount += copperArcs.filter(
        (trace) => trace.source_trace_id !== undefined,
      ).length
      netViaCount += vias.length
      expect(
        vias.every(
          (via) =>
            via.source_net_id !== undefined &&
            via.source_trace_id !== undefined,
        ),
      ).toBe(true)
    }

    expect(copperArcCount).toBe(15)
    expect(netCopperArcCount).toBe(15)
    expect(netViaCount).toBe(2877)
  },
  { timeout: 60_000 },
)

test(
  "inherits net ownership for all 536 TI copper areas",
  async () => {
    let netCopperAreaCount = 0
    for (const filename of tiPcbReferences) {
      const { document, circuit } = await getConvertedReference(filename)
      const copperAreas = new Map(
        circuit
          .filter((element) => element.type === "pcb_copper_pour")
          .map((element) => [element.pcb_copper_pour_id, element]),
      )
      for (const [recordIndex, record] of document.records.entries()) {
        const copperAreaId = getCopperAreaId({ document, record, recordIndex })
        const copperArea = copperAreaId
          ? copperAreas.get(copperAreaId)
          : undefined
        if (!copperArea) continue
        const polygon = document.getPolygonForRecord(record)
        const net =
          document.getNetForRecord(record) ??
          (polygon ? document.getNetForRecord(polygon) : undefined)
        if (!net) continue
        const netIndex = document.nets.indexOf(net)
        expect(copperArea.source_net_id).toBe(
          `source_net_altium_pcb_${netIndex}`,
        )
        netCopperAreaCount++
      }
    }

    expect(netCopperAreaCount).toBe(536)
  },
  { timeout: 60_000 },
)

function getConvertedPad({
  document,
  circuit,
  designator,
  pinName,
}: {
  document: AltiumPcbDocument
  circuit: ReturnType<typeof convertAltiumPcbDocToCircuitJson>
  designator: string
  pinName: string
}): PcbPlatedHoleWithPadStack {
  const recordIndex = document.records.findIndex(
    (record) =>
      record instanceof AltiumPadRecord &&
      record.name === pinName &&
      getPcbRecordComponent(document, record)?.designator === designator,
  )
  if (recordIndex < 0) {
    throw new Error(`Missing ${designator} pin ${pinName}`)
  }
  const pad = circuit.find(
    (element): element is PcbPlatedHoleWithPadStack =>
      element.type === "pcb_plated_hole" &&
      element.pcb_plated_hole_id === `pcb_plated_hole_altium_${recordIndex}`,
  )
  if (!pad) {
    throw new Error(`Missing converted ${designator} pin ${pinName}`)
  }
  return pad
}

function getCopperAreaId({
  document,
  record,
  recordIndex,
}: {
  document: AltiumPcbDocument
  record: AltiumFillRecord | AltiumPolygonRecord | AltiumRegionRecord | unknown
  recordIndex: number
}): string | undefined {
  if (record instanceof AltiumRegionRecord) {
    return `pcb_copper_pour_altium_region_${recordIndex}`
  }
  if (record instanceof AltiumFillRecord) {
    return `pcb_copper_pour_altium_fill_${recordIndex}`
  }
  if (record instanceof AltiumPolygonRecord) {
    return `pcb_copper_pour_altium_polygon_${document.polygons.indexOf(record)}`
  }
  return undefined
}
