"""Replay only terminal jobs in the named isolated test queue; never new input."""
from pathlib import Path
import json, subprocess

root=Path(__file__).resolve().parents[1]
out=root/'docs/llm001-1/final-v152'
run=json.loads((out/'test-fixtures.json').read_text(encoding='utf-8-sig'))['runId']
source=(root/'tests/backend/llm0011-redelivery.php').read_text(encoding='utf-8')

def snapshot(action):
    result=subprocess.run(['docker','compose','exec','-T','-e','LLM0011_RUN='+run,'-e','LLM0011_ACTION='+action,'app-test','php'],input=source,cwd=root.parent/'school',encoding='utf-8',capture_output=True,check=True)
    return json.loads(result.stdout)

before=snapshot('before')
(out/'redelivery-before.json').write_text(json.dumps(before,indent=2),encoding='utf-8')
snapshot('dispatch')
result=subprocess.run(['docker','compose','exec','-T','-e','LLM0011_RUN='+run,'app-test','php','scripts/llm0011-worker.php','--drain'],cwd=root.parent/'school',encoding='utf-8',capture_output=True,timeout=90)
(out/'redelivery-worker.log').write_text(result.stdout+result.stderr,encoding='utf-8')
assert result.returncode==0
after=snapshot('after')
(out/'redelivery-after.json').write_text(json.dumps(after,indent=2),encoding='utf-8')
for field in ('gatewayCalls','gatewayRequests','scenarios','revisions','generationRuns','comparisons'):
    assert before[field]==after[field],field
assert after['queueSize']==0
(out/'redelivery.exit').write_text('0\n',encoding='ascii')
print('PASS: terminal job redelivery drained; no HTTP starts or new persisted results.')
