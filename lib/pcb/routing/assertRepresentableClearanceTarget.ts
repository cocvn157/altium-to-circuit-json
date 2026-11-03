import type { AltiumClearanceQuery } from "./AltiumClearanceQuery"

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
