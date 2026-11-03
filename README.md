# altium-to-circuit-json

Convert Altium schematic and PCB documents into [Circuit JSON](https://github.com/tscircuit/circuit-json).

The converter is built on [altiumts](https://github.com/tscircuit/altiumts). Its visual tests render the original document with `altiumts` on the left and the converted Circuit JSON with `circuit-to-svg` on the right, then combine the panels with `stack-svgs` and verify them with `bun-match-svg`.

## Install

```sh
bun add altium-to-circuit-json
```

## Usage

Automatic format detection accepts text, `Uint8Array`, or `ArrayBuffer` input:

```ts
import { readFile } from "node:fs/promises"
import { convertAltiumToCircuitJson } from "altium-to-circuit-json"

const bytes = await readFile("motor-controller.PcbDoc")
const circuitJson = convertAltiumToCircuitJson(bytes)
```

Parsed `altiumts` documents can be converted directly:

```ts
import { parseAltiumSchDoc } from "altiumts"
import { convertAltiumSchDocToCircuitJson } from "altium-to-circuit-json"

const document = parseAltiumSchDoc(schematicBytes)
const circuitJson = convertAltiumSchDocToCircuitJson(document)
```

Convert a PCB and its schematic sheets together when they belong to one
project. The project converter gives every document its own ID scope, then
reconciles components, pins, named nets, and traces into shared source
identities:

```ts
const circuitJson = convertAltiumProjectToCircuitJson({
  pcb: { document: pcbDocument },
  schematics: [
    { document: powerSchematic },
    { document: controllerSchematic },
  ],
})
```

For custom document assembly, the individual document converters also accept a
stable `idPrefix` that is applied to every Circuit JSON ID and reference.

The public conversion functions are:

- `convertAltiumToCircuitJson(source, options)` for automatic parsing and conversion.
- `convertAltiumDocumentToCircuitJson(document, options)` for an already parsed document.
- `convertAltiumPcbDocToCircuitJson(document, options)` for PCB documents.
- `convertAltiumProjectToCircuitJson(input)` for a PCB and its schematic sheets.
- `convertAltiumSchDocToCircuitJson(document, options)` for schematic documents.

For callers that need progress visibility, debugging, or custom orchestration,
the same conversion is exposed as a staged converter:

```ts
import { AltiumToCircuitJsonConverter } from "altium-to-circuit-json"

const converter = new AltiumToCircuitJsonConverter(bytes)
while (!converter.finished) {
  console.log(converter.currentStage?.constructor.name)
  converter.step()
}
const circuitJson = converter.getOutput()
```

Each stage has the standard converter contract: `step()`,
`runUntilFinished()`, `finished`, and `getOutput()`. The parser boundary stays
in `altiumts`; conversion stages consume typed Altium documents and records.

## Copper pour definitions

By default, PCB conversion preserves saved copper geometry. To prepare a board
for fresh routing and pouring, use:

```ts
const circuitJson = convertAltiumPcbDocToCircuitJson(pcbDocument, {
  copperPourMode: "recompute",
  includeTraces: false,
  includeVias: false,
})
```

This imports the authored polygon boundaries, cutouts, nets, layers, and global
clearances. Only saved fills and regions linked to a polygon are discarded;
standalone authored copper is retained. Missing or scoped clearance rules are
rejected. Custom thermals and pour priority are not mapped.

The current TI power-reference boards contain scoped clearance rules, so full
board conversion in this mode rejects them until those rules can be represented.

This converter does not route traces or run a copper pour solver. Its output and
SVG show input definitions, not a finished or clearance-verified pour. To compute
new copper, convert the definitions to TSX with
`convertCircuitJsonToTscircuit(circuitJson, { componentName: "ImportedBoard", copperPourMode: "recompute" })`
from `circuit-json-to-tscircuit`, then render that TSX through core. Core performs
the routing and copper pour computation.

## Current coverage

PCB conversion currently emits:

- polygon board outlines and board cutouts;
- PCB component placement bounds;
- top, bottom, and inner-layer copper tracks;
- vias;
- circular, rectangular, rounded, octagonal, rotated, pill, slotted, plated, and non-plated pads/holes;
- top and bottom silkscreen lines, arcs, fills, and text; and
- Altium mil coordinates converted to millimeters.

Copper layers follow the board's physical stack order, including interleaved
signal and plane layers. Layer IDs and custom stack names resolve to the same
Circuit JSON layer. The current schema supports up to ten copper layers
(`top`, `inner1`–`inner8`, `bottom`). Conversion throws for larger or ambiguous
stacks and for copper layers absent from the stack. Documents without stack
information support outer-layer copper only.

Schematic conversion currently emits:

- a Circuit JSON `schematic_sheet`, with imported geometry page-fitted and
  centered inside its standard A4 drawing area;
- typed source components, source ports, source nets, and source traces;
- standard Circuit JSON resistor, capacitor, inductor, diode, LED, test-point,
  power, and ground symbols;
- box-with-pins schematic components with named and numbered schematic ports
  for chips, connectors, and other multi-pin parts;
- wires as schematic traces, including mid-segment labels, pin terminals,
  T-junctions, and explicit junctions;
- polylines, polygons, rectangles, circles, ellipses, and arcs;
- no-ERC markers, hierarchical ports, and power ports;
- labels, net labels, designators, parameters, and text frames; and
- active multipart/display-mode filtering, with multiple placed symbol parts
  sharing one physical source component.

By default, schematic coordinates are scaled from the Altium page dimensions
and centered on the emitted `schematic_sheet`. Set `schematicUnitScale` to use
an explicit coordinate scale, or `centerOnSchematicSheet: false` to preserve an
Altium-style origin. The old plain rectangular page outline remains available
as an opt-in compatibility overlay with `includeSheetBorder: true`.

The package is intentionally an incremental converter. Complete component
classification, copper pours/regions, mechanical/dimension primitives, models,
and project-level hierarchy remain follow-up areas.

## Visual tests

Download the checksum-pinned upstream reference files and run the tests:

```sh
bun run test
```

Update the SVG snapshots after an intentional visual change:

```sh
bun run test:update-svg
```

Every imported reference used by the test suite has a side-by-side SVG snapshot. The committed fixtures are generated from pinned upstream URLs and are not stored in this repository.

The real-world PCB corpus covers NodeMCU ESP-12, EBAZ4205, HERON Payload SSM,
SimpleFOC Mini, and SimpleFOC Shield V3. The schematic corpus covers NodeMCU,
HERON PAY-SSM and Systems PCB, SimpleFOC Mini, and SimpleFOC Shield V3.

The TI power-reference PCB corpus covers PMP23595, the PMP23653 main and planar
transformer boards, and the PMP22650 package's PMP22650, PMP22712, and PMP22773
boards. Each is downloaded directly from its checksum-pinned TI CAD/CAE archive
and has an Altium-to-Circuit-JSON side-by-side SVG repro.

The TI EVM corpus covers DRV8307EVM, LM5155EVM-FLY, LM251772EVM-PD, and
LMG342X-BB-EVM. Their checksum-pinned PCB, electrical schematic, and hardware
drawing documents each have an Altium-to-Circuit-JSON side-by-side SVG repro.
SK-AM62A-LP is not included in this corpus because TI publishes its source as an
Allegro ASCII board and OrCAD schematic rather than Altium `PcbDoc`/`SchDoc`
documents.

The TI SPRCAL9 / TMDS62LEVM Rev. B regression corpus includes all 57
schematic sheets and a full top-side PCB comparison. Its large downloaded source
files are checksum-verified and cached in CI. To also write the complete
converted Circuit JSON artifacts locally, run:

```sh
bun run convert:ti-reference
```

This creates `artifacts/ti-tmds62levm-rev-b/pcb.circuit.json`, one Circuit JSON
file per schematic sheet, and a conversion manifest. The artifact directory is
gitignored; the compact SVG regression snapshots remain committed.

## Development

```sh
bun install
bun run typecheck
bun run format:check
bun run build
```
