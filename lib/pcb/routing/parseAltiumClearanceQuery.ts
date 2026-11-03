import type { AltiumClearanceQuery } from "./AltiumClearanceQuery"
import {
  AltiumClearanceQueryParser,
  type AltiumClearanceToken,
} from "./AltiumClearanceQueryParser"

export function parseAltiumClearanceQuery(
  expression: string | undefined,
): AltiumClearanceQuery {
  const source = expression ?? "All"
  const tokens: AltiumClearanceToken[] = []
  const matcher =
    /\s+|'(?:''|[^'])*'|"(?:""|[^"])*"|[A-Za-z_][A-Za-z_0-9]*|[()]/gy
  let offset = 0
  while (offset < source.length) {
    matcher.lastIndex = offset
    const match = matcher.exec(source)
    if (!match) throw new Error("Unsupported Altium clearance query syntax")
    const text = match[0]
    offset = matcher.lastIndex
    if (/^\s/u.test(text)) continue
    const quoted = text.startsWith("'") || text.startsWith('"')
    tokens.push({
      text: quoted
        ? text.slice(1, -1).replace(text[0] === "'" ? /''/gu : /""/gu, text[0]!)
        : text,
      quoted,
    })
  }
  return new AltiumClearanceQueryParser(tokens).parse()
}
