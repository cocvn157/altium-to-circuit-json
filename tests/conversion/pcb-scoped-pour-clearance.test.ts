import { expect, test } from "bun:test"
import { parseAltiumPcbDoc } from "altiumts"
import type { CopperPourClearanceObjectType, PcbCopperPour } from "circuit-json"
import { convertAltiumPcbDocToCircuitJson } from "../../lib"
import { copperPourDefinitionRecords } from "../fixtures/copper-pour-definition"

test("preserves TI net-class priorities, multilayer targets, hole matrices and polygon edge rules", () => {
  const circuit = convertAltiumPcbDocToCircuitJson(
    parseAltiumPcbDoc(
      [
        ...copperPourDefinitionRecords.filter(
          (record) => !record.includes("RECORD=Rule"),
        ),
        "|RECORD=Net|NAME=HV_A",
        "|RECORD=Net|NAME=HV_B",
        "|RECORD=Net|NAME=EARTH",
        "|RECORD=Class|NAME=HV|KIND=0|M0=HV_A|M1=HV_B",
        "|RECORD=Rule|NAME=Earth|RULEKIND=Clearance|PRIORITY=1|SCOPE1EXPRESSION=OnTopLayer And InNet('EARTH')|SCOPE2EXPRESSION=All|GAP=160mil",
        "|RECORD=Rule|NAME=HV outside|RULEKIND=Clearance|PRIORITY=2|SCOPE1EXPRESSION=InNetClass('HV') And (OnTopLayer Or IsVia Or IsPad) And InAnyNet|SCOPE2EXPRESSION=Not InNetClass('HV') And (OnTopLayer Or IsVia Or IsPad) And InAnyNet|GAP=60mil",
        "|RECORD=Rule|NAME=Polygon|RULEKIND=Clearance|PRIORITY=3|SCOPE1EXPRESSION=InPolygon|SCOPE2EXPRESSION=All|GAP=5.5mil|OBJECTCLEARANCES=ClearanceObj_Poly-ClearanceObj_Hole:55118",
        "|RECORD=Rule|NAME=Global|RULEKIND=Clearance|PRIORITY=4|SCOPE1EXPRESSION=All|SCOPE2EXPRESSION=All|GAP=10mil",
        "|RECORD=Rule|RULEKIND=BoardOutlineClearance|PRIORITY=1|SCOPE1EXPRESSION=OnCopper And IsPoly|GAP=25mil",
        // A lower-priority rule cannot override the polygon rule or block it on unsupported syntax.
        "|RECORD=Rule|RULEKIND=BoardOutlineClearance|PRIORITY=2|SCOPE1EXPRESSION=Not InRegion(1000,500,4000,800)|GAP=75mil",
      ].join("\n"),
    ),
    { copperPourMode: "recompute" },
  )
  const pour = circuit.find(
    (element): element is PcbCopperPour => element.type === "pcb_copper_pour",
  )!
  const netId = (name: string) =>
    circuit.find(
      (element) => element.type === "source_net" && element.name === name,
    )!
  const gap = (
    net: string | undefined,
    kind: CopperPourClearanceObjectType,
  ) => {
    const target = net ? netId(net) : undefined
    const sourceNetId =
      target?.type === "source_net" ? target.source_net_id : undefined
    return (
      pour.clearance_rules?.find(
        (rule) =>
          (!rule.source_net_ids ||
            (!!sourceNetId && rule.source_net_ids.includes(sourceNetId))) &&
          (!rule.object_types || rule.object_types.includes(kind)),
      )?.clearance ?? pour.clearance
    )
  }
  expect(gap("HV_A", "trace")).toBe(1.524)
  expect(gap("HV_A", "plated_hole")).toBe(1.524)
  expect(gap("EARTH", "trace")).toBe(4.064)
  // OnTopLayer does not select a via's native Multi-Layer identity.
  expect(gap("EARTH", "via")).toBeCloseTo(0.1397)
  expect(gap(undefined, "trace")).toBeCloseTo(0.1397)
  expect(gap(undefined, "hole")).toBeCloseTo(0.13999972)
  expect(pour.board_edge_margin).toBe(0.635)

  const hvCircuit = convertAltiumPcbDocToCircuitJson(
    parseAltiumPcbDoc(
      [
        ...copperPourDefinitionRecords
          .filter((record) => !record.includes("RECORD=Rule"))
          .map((record) => record.replace("|NAME=GND", "|NAME=HV_A")),
        "|RECORD=Net|NAME=HV_B",
        "|RECORD=Net|NAME=LV",
        "|RECORD=Class|NAME=HV|KIND=0|M0=HV_A|M1=HV_B",
        "|RECORD=Rule|RULEKIND=Clearance|PRIORITY=1|SCOPE1EXPRESSION=InNetClass('HV')|SCOPE2EXPRESSION=Not InNetClass('HV') And InAnyNet|GAP=60mil",
        "|RECORD=Rule|RULEKIND=Clearance|PRIORITY=2|SCOPE1EXPRESSION=All|SCOPE2EXPRESSION=All|GAP=5.5mil",
      ].join("\n"),
    ),
    { copperPourMode: "recompute" },
  )
  const hvPour = hvCircuit.find(
    (element) => element.type === "pcb_copper_pour",
  )!
  expect(
    hvPour.type === "pcb_copper_pour" &&
      hvPour.clearance_rules
        ?.filter((rule) => rule.object_types?.[0] !== "hole")
        .every((rule) => rule.source_net_ids?.length === 1),
  ).toBe(true)
  const lvNet = hvCircuit.find(
    (element) => element.type === "source_net" && element.name === "LV",
  )!
  expect(hvPour).toMatchObject({
    clearance: 0.1397,
    clearance_rules: expect.arrayContaining([
      expect.objectContaining({
        clearance: 1.524,
        source_net_ids: [lvNet.type === "source_net" && lvNet.source_net_id],
      }),
    ]),
  })
})
