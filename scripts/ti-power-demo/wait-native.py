import json,os,time,urllib.request
run_id=41744398325
url=f'https://api.github.com/repos/tscircuit/altium-to-circuit-json/actions/runs/{run_id}'
for attempt in range(200):
 request=urllib.request.Request(url,headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'})
 with urllib.request.urlopen(request,timeout=30) as response:run=json.load(response)
 if run['head_sha']!='adbf3391b2fa5364320142c0be801df8d6357105':raise RuntimeError('Unexpected native validation commit')
 if run['status']=='completed':
  if run['conclusion']!='success':raise RuntimeError('All six native boards must pass before building the demo')
  print('All six native boards passed');break
 time.sleep(30)
else:raise RuntimeError('Native validation is still incomplete')
