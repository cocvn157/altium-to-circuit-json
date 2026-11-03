import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { readFile, writeFile } from "node:fs/promises"

// Validate the three-line source fix against the pinned published build while
// its upstream PR is reviewed. This changes polygon sampling, not routing policy.
const entry = fileURLToPath(import.meta.resolve("@tscircuit/core"))
const version = JSON.parse(await readFile(join(dirname(entry), "../package.json"), "utf8")).version
if (version !== "0.0.2259") throw new Error(`Recheck small-polygon patch for core ${version}`)
const source = await readFile(entry, "utf8")
const start = source.indexOf("function fillPolygonWithRects(polygon3, options = {}) {")
if (start < 0) throw new Error("Missing pinned polygon sampler")
const end = source.indexOf("\n}", start) + 2
const original = source.slice(start, end)
const previous = "    const scanlineY = y2 + rectHeight / 2;"
if (!original.includes(previous) || !original.includes("height: rectHeight")) throw new Error("Pinned polygon sampler changed")
const fixed = original.replace(previous, "    const height = Math.min(rectHeight, maxY - y2);\n    const scanlineY = y2 + height / 2;").replace("height: rectHeight", "height")
await writeFile(entry, source.slice(0,start) + fixed + source.slice(end))
console.log("Applied small-polygon sampling source fix to core 0.0.2259")
