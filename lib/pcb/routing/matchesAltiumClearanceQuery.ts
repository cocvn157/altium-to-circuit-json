import type {
  AltiumClearanceObject,
  AltiumClearanceQuery,
} from "./AltiumClearanceQuery"

/** Resolve Altium selectors against copper identities, not polygon containment. */
export function matchesAltiumClearanceQuery(
  query: AltiumClearanceQuery,
  copper: AltiumClearanceObject,
): boolean {
  if (query.kind === "and")
    return (
      matchesAltiumClearanceQuery(query.left, copper) &&
      matchesAltiumClearanceQuery(query.right, copper)
    )
  if (query.kind === "or")
    return (
      matchesAltiumClearanceQuery(query.left, copper) ||
      matchesAltiumClearanceQuery(query.right, copper)
    )
  if (query.kind === "not")
    return !matchesAltiumClearanceQuery(query.query, copper)
  const multilayer =
    copper.objectType === "via" ||
    copper.objectType === "plated_hole" ||
    copper.objectType === "hole"
  if (query.kind === "call") {
    const argument = query.argument.toUpperCase()
    if (query.name === "INNET")
      return copper.netName?.toUpperCase() === argument
    if (query.name === "INNETCLASS") return copper.netClasses.has(argument)
    if (query.name === "INCOMPONENTCLASS") {
      if (!copper.componentClasses)
        throw new Error(
          "Component-scoped target copper clearances cannot be represented",
        )
      return copper.componentClasses.has(argument)
    }
    // OnLayer tests the native Layer property: pads/vias on Multi-Layer do not match.
    // https://www.altium.com/documentation/knowledge-base/altium-designer/layer-specific-design-rules-with-through-hole-pads-and-vias
    return (
      !multilayer && copper.layerMap.getLayer(query.argument) === copper.layer
    )
  }
  switch (query.name) {
    case "ALL":
      return true
    case "ONCOPPER":
      return true
    case "ONTOPSILKSCREEN":
    case "ONBOTTOMSILKSCREEN":
      return false
    // InPoly and InPolygon select pours and their owned primitives, not nearby copper.
    case "INPOLY":
    case "INPOLYGON":
    case "ISPOLY":
    case "ISPOLYGON":
      return copper.objectType === "copper_pour"
    case "ISPAD":
      return (
        copper.objectType === "smtpad" || copper.objectType === "plated_hole"
      )
    case "ISVIA":
      return copper.objectType === "via"
    case "ISTRACK":
      return copper.objectType === "trace"
    case "ISARC":
      return false
    case "ISKEEPOUT":
    case "KEEPOUT":
      return false
    case "ISFREE":
      return copper.isFree
    case "INANYNET":
      return copper.netName !== undefined
    case "ONTOPLAYER":
      return !multilayer && copper.layer === "top"
    case "ONBOTTOMLAYER":
      return !multilayer && copper.layer === "bottom"
  }
  throw new Error(`Unsupported Altium clearance query keyword ${query.name}`)
}

export function assertRepresentableClearanceTarget(
  query: AltiumClearanceQuery,
): void {
  if (query.kind === "and" || query.kind === "or") {
    assertRepresentableClearanceTarget(query.left)
    assertRepresentableClearanceTarget(query.right)
  } else if (query.kind === "not") {
    assertRepresentableClearanceTarget(query.query)
  } else if (
    query.name === "INCOMPONENTCLASS" ||
    query.name === "ISFREE" ||
    query.name === "ISARC"
  ) {
    throw new Error(
      `Cannot preserve target-scoped Altium clearance query ${query.name}`,
    )
  }
}
