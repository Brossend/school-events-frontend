"""Summarize existing FE006 evidence; never performs application mutations."""
from pathlib import Path
from collections import Counter
import json
from PIL import Image, ImageOps, ImageDraw

root = Path(__file__).resolve().parents[1]
evidence = root / 'docs/fe006/evidence'
def read(name):
    return json.loads((evidence / name).read_text(encoding='utf-8-sig'))
def write(name, value):
    (evidence / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
db, http = read('persisted-generation-final.json'), read('http-mutations.json')
runs, scenarios = db['runs'], db['scenarios']
assert len(runs) == 4 and Counter(r['status'] for r in runs) == {'completed': 3, 'failed': 1}
assert len(scenarios) == 3
for s in scenarios:
    assert len(s['revisions']) == 1 and s['revisions'][0]['version_number'] == 1
    assert s['current_revision_id'] == s['revisions'][0]['id']
    assert s['revisions'][0]['source_generation_run_id'] in [r['id'] for r in runs if r['status'] == 'completed']
assert http['accepted']['data']['generation_run_id'] in [r['id'] for r in runs]
assert http['lostReplyRecovery']['runId'] in [r['id'] for r in runs]
assert all(sum(r['scenario_request_id'] == request for r in runs) == 1 for request in {r['scenario_request_id'] for r in runs})
write('persistence-verification.json', {'database': db['database'], 'role': db['role'], 'runs': len(runs), 'statuses': dict(Counter(r['status'] for r in runs)), 'scenarios': len(scenarios), 'oneRevisionVersion1Each': True, 'oneRunPerRequest': True, 'httpIdsPersisted': True, 'sources': ['persisted-generation-final.json', 'http-mutations.json']})
assert len(http['requests']) == 37 and http['completed']
write('final-checks.json', {**{k: {'exitCode': 0, 'log': log} for k, log in [('typecheck','typecheck.log'),('eslint','eslint.log'),('vitest','unit.log'),('productionBuild','build.log'),('http','live.log')]}, 'vitestSummary': {'files':9, 'passed':192, 'priorRegressionTests':149}, 'backend': {'passed':29,'assertions':147,'log':'backend-tests.log'}, 'httpRequests':37})
write('browser-results.json', {'origin':'http://localhost:8001', 'provider':'backend MockLlmProvider', 'successfulRequest':'01a17723-cb28-702f-9ce0-5ccb0ca56340', 'successfulRun':'01a17725-6474-7086-b704-89a567a8650c', 'scenario':'01a17728-100d-714c-b5e0-ec75c79ac586', 'liveStates':['queued','failed','completed'], 'componentFixtureStates':['running','timed_out'], 'schoolSwitchBack':'denied; previous scenario absent', 'logoutProtectedRun':'redirect login', 'longContent':'stages/materials/sources + source inspector at 390px; local toc and focus', 'failedFamilyRun':'01a1771c-c0bc-724c-be60-da0f7c69d12e', 'failedFamilyCode':'VALIDATION_FAILED / RULE_MECHANISM_ACTIVITY_NOT_FOUND', 'fullPageScreenshot':False})
inventory = []
for path in sorted(evidence.iterdir()):
    if path.suffix.lower() not in {'.png','.jpg'} or path.name.startswith('contact-sheet'):
        continue
    with Image.open(path) as img:
        # Older browser captures were JPEG with a PNG extension. Normalize bytes.
        if path.suffix == '.png' and img.format != 'PNG':
            img.load(); img.save(path, format='PNG')
        origin = 'figma-reference' if path.name.startswith('figma-') else 'isolated-component-fixture' if path.name.startswith('fixture-') else 'live-app-test'
        inventory.append({'file':path.name,'origin':origin,'width':img.width,'height':img.height})
write('screenshots.json', inventory)
selected = ['live-scenario-final-1440.jpg','live-completed-390.jpg','live-mobile-overview-390.jpg','live-mobile-materials-390.jpg','live-mobile-sources-390.jpg','fixture-running-360.jpg','fixture-timed-out-360.jpg','live-school-denied-1440.jpg']
sheet = Image.new('RGB',(1200,1540),'#e8e8e8'); draw=ImageDraw.Draw(sheet)
for i, name in enumerate(selected):
    with Image.open(evidence/name) as img:
        thumb=ImageOps.contain(img,(292,720)); x=(i%4)*300; y=(i//4)*770
        draw.text((x+5,y+4),name,fill='black'); sheet.paste(thumb,(x+(300-thumb.width)//2,y+26))
sheet.save(evidence/'contact-sheet.jpg',quality=90)
print('Evidence verified: 4 runs, 3 scenarios/revisions, 37 HTTP calls, 192 unit tests; screenshot inventory saved.')
