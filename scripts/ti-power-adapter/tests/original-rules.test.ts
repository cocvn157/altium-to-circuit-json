import { expect, test } from "bun:test"
import { parseAltiumPcbDoc } from "altiumts"
import { RuleResolver } from "../rules/RuleResolver"
import type { CopperIdentity } from "../types"

test("native rule priorities, net classes, multilayer pads and hole matrices stay outside Circuit JSON", () => {
  const document = parseAltiumPcbDoc([
    "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=500mil|VY1=0mil|VX2=500mil|VY2=400mil|VX3=0mil|VY3=400mil",
    "|RECORD=Net|NAME=GND", "|RECORD=Net|NAME=HV_A", "|RECORD=Net|NAME=HV_B", "|RECORD=Net|NAME=EARTH",
    "|RECORD=Class|NAME=HV|KIND=0|M0=HV_A|M1=HV_B",
    "|RECORD=Rule|RULEKIND=Clearance|PRIORITY=1|SCOPE1EXPRESSION=OnTopLayer And InNet('EARTH')|SCOPE2EXPRESSION=All|GAP=160mil",
    "|RECORD=Rule|RULEKIND=Clearance|PRIORITY=2|SCOPE1EXPRESSION=InNetClass('HV') And (OnTopLayer Or IsVia Or IsPad) And InAnyNet|SCOPE2EXPRESSION=Not InNetClass('HV') And (OnTopLayer Or IsVia Or IsPad) And InAnyNet|GAP=60mil",
    "|RECORD=Rule|RULEKIND=Clearance|PRIORITY=3|SCOPE1EXPRESSION=InPolygon|SCOPE2EXPRESSION=All|GAP=5.5mil|OBJECTCLEARANCES=ClearanceObj_Poly-ClearanceObj_Hole:55118",
    "|RECORD=Rule|RULEKIND=Clearance|PRIORITY=4|SCOPE1EXPRESSION=All|SCOPE2EXPRESSION=All|GAP=10mil",
    "|RECORD=Rule|RULEKIND=BoardOutlineClearance|PRIORITY=1|SCOPE1EXPRESSION=OnCopper And IsPoly|GAP=25mil",
    "|RECORD=Rule|RULEKIND=BoardOutlineClearance|PRIORITY=2|SCOPE1EXPRESSION=Not InRegion(1000,500,4000,800)|GAP=75mil",
  ].join("\n"))
  const originalRules = document.rules.length
  const resolver = new RuleResolver(document)
  const ground: CopperIdentity = { objectType:"copper_pour",matrixKind:"Poly",layer:"top",netName:"GND",isFree:true }
  const hv: CopperIdentity = {...ground,netName:"HV_A",objectType:"trace",matrixKind:"Track"}
  expect(resolver.clearance(ground,hv)).toBe(1.524)
  expect(resolver.clearance({...ground,netName:"HV_B"},hv)).toBe(.1397)
  expect(resolver.clearance(ground,{...hv,netName:"EARTH"})).toBe(4.064)
  expect(resolver.clearance(ground,{...hv,netName:"EARTH",objectType:"via",matrixKind:"Via"})).toBe(.1397)
  expect(resolver.clearance(ground,{...hv,netName:undefined,objectType:"hole",matrixKind:"Hole"})).toBeCloseTo(.13999972)
  expect(resolver.boardEdge(ground)).toBe(.635)
  expect(document.rules).toHaveLength(originalRules)
})
