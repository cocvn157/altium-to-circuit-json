import type { AltiumClearanceQuery } from "./AltiumClearanceQuery"

interface AltiumClearanceToken {
  text: string
  quoted: boolean
}
const keywords = new Set([
  "ALL",
  "INPOLY",
  "INPOLYGON",
  "ISPOLY",
  "ISPOLYGON",
  "ONCOPPER",
  "ONTOPSILKSCREEN",
  "ONBOTTOMSILKSCREEN",
  "ISPAD",
  "ISVIA",
  "ISTRACK",
  "ISARC",
  "ISKEEPOUT",
  "KEEPOUT",
  "ISFREE",
  "INANYNET",
  "ONTOPLAYER",
  "ONBOTTOMLAYER",
])
const functions = new Set([
  "INNET",
  "INNETCLASS",
  "INCOMPONENTCLASS",
  "ONLAYER",
])

class AltiumClearanceQueryParser {
  private offset = 0
  constructor(private readonly tokens: AltiumClearanceToken[]) {}

  parse(): AltiumClearanceQuery {
    const query = this.parseOr()
    if (this.offset !== this.tokens.length)
      throw new Error("Unsupported trailing Altium clearance query syntax")
    return query
  }

  private consume(text: string): boolean {
    const token = this.tokens[this.offset]
    if (!token || token.quoted || token.text.toUpperCase() !== text)
      return false
    this.offset++
    return true
  }

  private parseOr(): AltiumClearanceQuery {
    let query = this.parseAnd()
    while (this.consume("OR"))
      query = { kind: "or", left: query, right: this.parseAnd() }
    return query
  }

  private parseAnd(): AltiumClearanceQuery {
    let query = this.parseUnary()
    while (this.consume("AND"))
      query = { kind: "and", left: query, right: this.parseUnary() }
    return query
  }

  private parseUnary(): AltiumClearanceQuery {
    if (this.consume("NOT")) return { kind: "not", query: this.parseUnary() }
    if (this.consume("(")) {
      const query = this.parseOr()
      if (!this.consume(")"))
        throw new Error("Unclosed Altium clearance query group")
      return query
    }
    const token = this.tokens[this.offset++]
    if (!token || token.quoted)
      throw new Error("Expected an Altium clearance query keyword")
    const name = token.text.toUpperCase()
    if (this.consume("(")) {
      if (!functions.has(name))
        throw new Error(
          `Unsupported Altium clearance query function ${token.text}`,
        )
      const argument = this.tokens[this.offset++]
      if (!argument?.quoted || !this.consume(")"))
        throw new Error(`Expected one quoted argument for ${token.text}`)
      return { kind: "call", name, argument: argument.text }
    }
    if (!keywords.has(name))
      throw new Error(
        `Unsupported Altium clearance query keyword ${token.text}`,
      )
    return { kind: "keyword", name }
  }
}

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
