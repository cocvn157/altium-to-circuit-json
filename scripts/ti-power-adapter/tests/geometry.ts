import type { CircuitJson, Point } from "circuit-json"
export function hasCopperPourAt(
  circuitJson: CircuitJson,
  point: Point,
): boolean {
  return circuitJson.some(
    (element) =>
      element.type === "pcb_copper_pour" &&
      element.shape === "brep" &&
      isPointInsideRing(element.brep_shape.outer_ring.vertices, point) &&
      !element.brep_shape.inner_rings.some((ring) =>
        isPointInsideRing(ring.vertices, point),
      ),
  )
}

function isPointInsideRing(vertices: Point[], point: Point): boolean {
  let inside = false
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i]!
    const b = vertices[j]!
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside
    }
  }
  return inside
}
