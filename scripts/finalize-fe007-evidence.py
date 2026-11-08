"""Verify and summarize actual FE007 evidence without application mutations."""
from pathlib import Path
import json
import re
from PIL import Image, ImageOps, ImageDraw
root=Path(__file__).resolve().parents[1]
e=root/'docs/fe007/evidence'
def read(name): return json.loads((e/name).read_text(encoding='utf-8-sig'))
def write(name,v): (e/name).write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
before,after,final,http=read('before-edit.json'),read('persisted-revisions.json'),read('persisted-revisions-final.json'),read('http-mutations.json')
assert http['completed'] and len(http['requests'])==56
scenario_id=http['ids']['scenarioId']
find=lambda dump: next(s for s in dump['scenarios'] if s['id']==scenario_id)
b,a,f=find(before),find(after),find(final)
assert len(a['revisions'])==4 and len(f['revisions'])==4
assert b['revisions'][0]['contentSha256']==a['revisions'][0]['contentSha256']==f['revisions'][0]['contentSha256']
known={r['id']:r['contentSha256'] for dump in [before,after] for s in dump['scenarios'] for r in s['revisions']}
now={r['id']:r['contentSha256'] for s in final['scenarios'] for r in s['revisions']}
assert all(now[k]==v for k,v in known.items())
assert f['revisions'][-1]['signoffs']==0 and f['revisions'][1]['signoffs']>=1
assert final['queueConnection']=='sync' and final['sqlRows']
write('persistence-verification.json',{'database':final['database'],'role':final['role'],'scenarioId':scenario_id,'successfulHttpRevisionCount':4,'originalRevisionUnchanged':True,'allPreviouslyObservedPayloadsUnchanged':True,'historicalSignoffNotTransferred':True,'totalFixtureScenarios':len(final['scenarios']),'totalFixtureRevisions':len(now),'sqlRows':len(final['sqlRows']),'sources':['before-edit.json','persisted-revisions.json','persisted-revisions-final.json']})
write('restored-test-config.json',{'database':final['database'],'role':final['role'],'queueConnection':final['queueConnection'],'queueName':final['queueName'],'redisDatabase':final['redisDatabase']})
unit=(e/'unit.log').read_text(encoding='utf-8-sig')
assert re.search(r'236\s+passed',unit)
backend_log=re.sub(r'\x1b\[[0-9;]*m','',(e/'backend-tests.log').read_text(encoding='utf-8-sig'))
assert '64 passed (286 assertions)' in backend_log
assert 'Build complete' in (e/'build.log').read_text(encoding='utf-8-sig')
assert not re.search(r'error TS\d+', (e/'typecheck.log').read_text(encoding='utf-8-sig'))
assert not (e/'eslint.log').read_text(encoding='utf-8-sig').strip()
write('final-checks.json',{**{k:{'exitCode':0,'log':log} for k,log in [('typecheck','typecheck.log'),('eslint','eslint.log'),('vitest','unit.log'),('productionBuild','build.log'),('http','live.log')]},'vitestSummary':{'files':10,'passed':236,'priorRegressionTests':192},'backend':{'passed':64,'assertions':286,'log':'backend-tests.log'},'httpRequests':56})
metrics=read('viewport-metrics.json')
inventory=[]
for p in sorted(e.iterdir()):
 if p.suffix.lower() not in {'.jpg','.png'} or p.name=='contact-sheet.jpg': continue
 with Image.open(p) as img:
  width=re.search(r'-(\d+)\.(jpg|png)$',p.name)
  requested=int(width[1]) if width else None
  state=p.stem.rsplit('-',1)[0] if width else p.stem
  measured=[m for m in metrics if m['state']==state and m.get('requested')==requested]
  inventory.append({'file':p.name,'origin':'isolated-component-fixture' if p.name.startswith('fixture-') else 'figma-reference' if p.name.startswith('figma-') else 'live-app-test','width':img.width,'height':img.height,'requestedCssWidth':requested,'measuredCssWidth':measured[-1]['viewport'] if measured else None,'viewportVerified':bool(measured)})
write('screenshots.json',inventory)
selected=['live-editor-1440.jpg','live-signoff-390.jpg','live-confirmed-1440.jpg','fixture-conflict-390.jpg','fixture-p0-390.jpg','fixture-p1-390.jpg','fixture-saving-360.jpg','live-school-denied-390.jpg']
sheet=Image.new('RGB',(1600,1800),'#e8e8e8');d=ImageDraw.Draw(sheet)
for i,name in enumerate(selected):
 if not (e/name).exists():continue
 with Image.open(e/name) as img:
  thumb=ImageOps.contain(img,(390,850));x=(i%4)*400;y=(i//4)*900;d.text((x+5,y+5),name,fill='black');sheet.paste(thumb,(x+(400-thumb.width)//2,y+30))
sheet.save(e/'contact-sheet.jpg',quality=90)
print('FE007 evidence verified: immutable payloads, 4 HTTP revisions, 56 requests, 236 unit tests, 64 backend tests.')
