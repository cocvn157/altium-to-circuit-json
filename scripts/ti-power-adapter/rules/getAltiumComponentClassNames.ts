import { AltiumClassRecord, type AltiumPcbDocument } from "altiumts"

export function getAltiumComponentClassNames(
  document: AltiumPcbDocument,
  designator: string | undefined,
): ReadonlySet<string> {
  const names = new Set<string>()
  if (!designator) return names
  const classes = document.records
    .filter((record) => record instanceof AltiumClassRecord)
    .filter((record) => record.classKind === "1")
  let changed = true
  while (changed) {
    changed = false
    for (const componentClass of classes) {
      if (!componentClass.name || names.has(componentClass.name.toUpperCase()))
        continue
      if (
        componentClass.members.some((member) =>
          componentClass.superClass
            ? names.has(member.toUpperCase())
            : member.toUpperCase() === designator.toUpperCase(),
        )
      ) {
        names.add(componentClass.name.toUpperCase())
        changed = true
      }
    }
  }
  return names
}
