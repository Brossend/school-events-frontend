"""Restore only the isolated app-test service after every scoped job is terminal."""
from pathlib import Path
import json, subprocess
from urllib.request import urlopen

root=Path(__file__).resolve().parents[1]
out=root/'docs/llm001-1/final-v152'
run=json.loads((out/'test-fixtures.json').read_text(encoding='utf-8-sig'))['runId']

def command(args,source=None,check=True):
    return subprocess.run(['docker','compose','-f','docker-compose.yml',*args],cwd=root.parent/'school',input=source,encoding='utf-8',capture_output=True,check=check)

state=json.loads(command(['exec','-T','-e','LLM0011_RUN='+run,'app-test','php'],(root/'tests/backend/llm0011-state.php').read_text(encoding='utf-8')).stdout)
assert state['database']=='school_events_test' and state['role']=='school_test_user'
assert not any(r['status'] in ('queued','running') for r in state['generationRuns'])
assert not any(c['status']=='pending' for c in state['comparisons'])
command(['exec','-T','app-test','pkill','-TERM','-f','^php scripts/llm0011-worker.php$'],check=False)
command(['up','-d','--no-deps','app-test'])
command(['exec','-T','nginx-test','nginx','-s','reload'])
php='''<?php
require '/var/www/html/vendor/autoload.php';
$app=require '/var/www/html/bootstrap/app.php';$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
$db=Illuminate\\Support\\Facades\\DB::selectOne('select current_database() as db,current_user as role');
echo json_encode(['environment'=>app()->environment(),'database'=>$db->db,'role'=>$db->role,'provider'=>config('llm.provider'),'queue'=>config('queue.default'),'configCache'=>app()->getCachedConfigPath()]);
'''
restored=json.loads(command(['exec','-T','app-test','php'],php).stdout)
assert restored['environment']=='testing' and restored['database']=='school_events_test' and restored['role']=='school_test_user'
assert restored['provider']=='mock' and restored['queue']=='sync'
production=json.loads(command(['exec','-T','app','php'],php).stdout)
assert production['provider']=='mock'
restored['productionProvider']=production['provider']
with urlopen('http://localhost:8001/api/v1/test/environment-probe',timeout=30) as response:
    probe=json.load(response)
assert probe['database']=='school_events_test'
restored['testHttpProbe']=probe
(out/'runtime-restored.json').write_text(json.dumps(restored,indent=2),encoding='utf-8')
print(json.dumps(restored,indent=2))
