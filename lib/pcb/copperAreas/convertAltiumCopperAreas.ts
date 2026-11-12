import {
  AltiumFillRecord,
  type AltiumPcbDocument,
  AltiumPolygonRecord,
  type AltiumRecord,
  AltiumRegionRecord,
  getPcbContour,
  getPcbRecordPolygonIndex,
  getPcbRegionGeometry,
} from "altiumts"
import type { PcbCopperPour } from "circuit-json"
import { PcbCopperLayerMap } from "../layers"
import { convertCopperFill } from "./convertCopperFill"
import { convertCopperPolygon } from "./convertCopperPolygon"
import { convertCopperRegion } from "./convertCopperRegion"
import { isContourInsideContour } from "./isContourInsideContour"

export function convertAltiumCopperAreas(
  document: AltiumPcbDocument,
  {
    layerMap = new PcbCopperLayerMap(document),
    getSourceNetId = () => undefined,
    copperPourMode = "preserve",
  }: {
    layerMap?: PcbCopperLayerMap
    copperPourMode?: "preserve" | "recompute"
    getSourceNetId?: (record: AltiumRecord) => string | undefined
  } = {},
): PcbCopperPour[] {
  const polygonsWithCopperRegions = new Set<AltiumPolygonRecord>()
  const cutoutsByPolygon = new Map<AltiumPolygonRecord, AltiumRegionRecord[]>()
  const polygonContours = new Map<
    AltiumPolygonRecord,
    ReturnType<typeof getPcbContour>
  >()
  for (const record of document.records) {
    if (
      !(record instanceof AltiumRegionRecord) ||
      record.recordKind !== "Region"
    ) {
      continue
    }
    const polygonIndex = getPcbRecordPolygonIndex(document, record)
    const linkedPolygon = document.getPolygonForRecord(record)
    if (record.regionKind === "COPPER") {
      if (record.getBoolean("KEEPOUT") === true) continue
      if (linkedPolygon) polygonsWithCopperRegions.add(linkedPolygon)
    } else if (record.regionKind === "POLYGON_CUTOUT") {
      const cutoutGeometry = getPcbRegionGeometry(record)
      const candidatePolygons =
        polygonIndex === undefined
          ? document.polygons
          : linkedPolygon
            ? [linkedPolygon]
            : []
      const polygons = candidatePolygons.filter((polygon) => {
        if (record.layer !== polygon.layer && record.layer !== "MULTILAYER") {
          return false
        }
        let polygonContour = polygonContours.get(polygon)
        if (!polygonContour) {
          polygonContour = getPcbContour(polygon)
          polygonContours.set(polygon, polygonContour)
        }
        return isContourInsideContour({
          innerContour: cutoutGeometry.outline,
          outerContour: polygonContour,
        })
      })
      for (const polygon of polygons) {
        const cutouts = cutoutsByPolygon.get(polygon) ?? []
        cutouts.push(record)
        cutoutsByPolygon.set(polygon, cutouts)
      }
    }
  }
  const polygonIndexes = new Map(
    document.polygons.map((polygon, index) => [polygon, index]),
  )

  const resolveSourceNetId = (record: AltiumRecord): string | undefined => {
    const directSourceNetId = getSourceNetId(record)
    if (directSourceNetId) return directSourceNetId
    const parentPolygon = document.getPolygonForRecord(record)
    if (!parentPolygon || parentPolygon === record) return undefined
    return getSourceNetId(parentPolygon)
  }

  return document.records.flatMap((record, recordIndex) => {
    if (record.getBoolean("KEEPOUT") === true) return []
    if (
      copperPourMode === "recompute" &&
      (record instanceof AltiumRegionRecord ||
        record instanceof AltiumFillRecord) &&
      document.getPolygonForRecord(record)
    ) {
      return []
    }
    if (record instanceof AltiumRegionRecord) {
      return convertCopperRegion({
        layerMap,
        record,
        recordIndex,
        sourceNetId: resolveSourceNetId(record),
      })
    }
    if (record instanceof AltiumPolygonRecord) {
      const polygonIndex = polygonIndexes.get(record)
      if (
        record.shelved === true ||
        polygonIndex === undefined ||
        (copperPourMode === "preserve" && polygonsWithCopperRegions.has(record))
      ) {
        return []
      }
      return convertCopperPolygon({
        cutouts: cutoutsByPolygon.get(record) ?? [],
        layerMap,
        polygonIndex,
        record,
        sourceNetId: resolveSourceNetId(record),
      })
    }
    if (record instanceof AltiumFillRecord) {
      return convertCopperFill({
        layerMap,
        record,
        recordIndex,
        sourceNetId: resolveSourceNetId(record),
      })
    }
    return []
  })
}
