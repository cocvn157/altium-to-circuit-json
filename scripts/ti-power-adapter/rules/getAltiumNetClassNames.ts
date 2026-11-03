import { AltiumClassRecord, type AltiumPcbDocument } from "altiumts"

/** Resolve named Altium net-class membership before runtime net identities change. */
export function getAltiumNetClassNames(
  document: AltiumPcbDocument,
  netName: string | undefined,
): ReadonlySet<string> {
  const names = new Set<string>()
  if (!netName) return names
  const netClasses = document.records
    .filter((record) => record instanceof AltiumClassRecord)
    .filter((record) =>
      ["0", "NET", "NETCLASS", "NET_CLASS"].includes(
        record.classKind?.toUpperCase() ?? "",
      ),
    )
  let changed = true
  while (changed) {
    changed = false
    for (const netClass of netClasses) {
      if (!netClass.name || names.has(netClass.name.toUpperCase())) continue
      if (
        netClass.members.some((member) =>
          netClass.superClass
            ? names.has(member.toUpperCase())
            : member.toUpperCase() === netName.toUpperCase(),
        )
      ) {
        names.add(netClass.name.toUpperCase())
        changed = true
      }
    }
  }
  return names
}
