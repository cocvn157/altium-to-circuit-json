import copy,hashlib,json,re,shutil,xml.etree.ElementTree as ET
from pathlib import Path
ET.register_namespace('','http://www.w3.org/2000/svg')
reports=Path('native-results');dataset=Path('original-dataset');assets=Path('dist/assets')
boards=json.loads(Path('board-labels.json').read_text())
expected={21:'18913410812b0993e4c8c3a00a489335d0fa58d27b79ec02e1294a8a6471e0f6',22:'18a785d61c6fbe381c504f416bb25fa50f16475710b9ce00f36b13b58d57c544',23:'e291efae1b3d42c8a90d3a01295a3a3129e6721d14163fc7c81045ffa2e29a5c',24:'bc20338d29b9323b5af9182f91041c14b192aa363cf2d7a323441a7f28210002',25:'3343b2cb765db52243ccfa584cdded44588d3ad85067e89192f09931b9a309c1',26:'a84ae2b3f463084053987c1bac0ce6c51c1b38b16bf53097d769366cd0eb59f7'}
for board in boards:
 sample=board['sample'];report=json.loads((reports/f'{sample}-report.json').read_text())
 if report['sample']!=sample or not report['routingEnabled'] or report['traces']<=0 or report['pours']<=report['fixed'] or report['newElectricalContacts'] or report['regressionErrors'] or report['runtimeMessages'] or report['routerProbe']['ownDrcErrors']:raise RuntimeError(f'Board {sample} failed validation')
 if report['sourcePcbDocSha256']!=expected[sample]:raise RuntimeError(f'Source mismatch for board {sample}')
 board.update(routed=True,connections=report['traces'],copperRecomputed=True,regressionErrors={},version=report['autorouterVersion'],seconds=report['elapsedMs']/1000,computedCopperAreas=report['pours']-report['fixed'],fixedCopperAreas=report['fixed'],sourcePcbDocSha256=report['sourcePcbDocSha256'],nativeHead='8a7f9222315ed991a9ed79b3b43e0ec6336df2ce',coreSourceFix='https://github.com/tscircuit/core/pull/5114')
assets.mkdir(parents=True,exist_ok=True)
for board in boards:
 sample=board['sample']
 for variant in ['routed','unrouted']:
  svg=reports/f'{sample}-{variant}.svg'
  if ET.parse(svg).getroot().tag!='{http://www.w3.org/2000/svg}svg':raise RuntimeError('Expected SVG')
  shutil.copyfile(svg,assets/svg.name)
 # The original column is the original public Altium rendering. Its copper
 # and traces are never inputs to the newly routed/poured columns.
 source=next((dataset/'snapshots').glob(f'sample{sample:03d}*-comparison.svg'))
 group=copy.deepcopy(list(ET.parse(source).getroot())[0]);transform=group.attrib.pop('transform')
 sx,sy=map(float,re.search(r'scale\(([^,]+),\s*([^\)]+)\)',transform).groups())
 image=ET.Element('{http://www.w3.org/2000/svg}svg',{'width':'1800','height':'1200','viewBox':f'0 0 {800/sx:.8f} {600/sy:.8f}','preserveAspectRatio':'xMidYMid meet','role':'img','aria-label':f'Original TI Altium layout, {board["design"]}'})
 image.append(group);ET.ElementTree(image).write(assets/f'{sample}-original.svg',encoding='utf-8',xml_declaration=False)
Path('copper-boards.json').write_text(json.dumps(boards,indent=2)+'\n')
