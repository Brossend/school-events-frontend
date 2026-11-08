"""Read-only isolated database/LLM audit export; no credentials in output."""
from pathlib import Path
import json, subprocess, sys
root = Path(__file__).resolve().parents[1]
out = root / (sys.argv[1] if len(sys.argv)>1 else 'docs/llm001-1/final-v152')
run = json.loads((out/'test-fixtures.json').read_text(encoding='utf-8-sig'))['runId']
suffix = sys.argv[2] if len(sys.argv)>2 else ''
def execute(args, text=None):
    result = subprocess.run(['docker','compose','exec','-T','-e','LLM0011_RUN='+run,'app-test',*args],
        cwd=root.parent/'school',input=text,capture_output=True,encoding='utf-8',check=True)
    return result.stdout
(out/('generated-samples'+suffix+'.json')).write_text(execute(['php','scripts/llm0011-result-review.php']),encoding='utf-8')
(out/('postgres-live'+suffix+'.json')).write_text(execute(['php'],(root/'tests/backend/llm0011-state.php').read_text(encoding='utf-8')),encoding='utf-8')
(out/'gateway-http.jsonl').write_text(execute(['cat','storage/app/llm0011-'+run+'/gateway-http.jsonl']),encoding='utf-8')
try:
    requests=execute(['cat','storage/app/llm0011-'+run+'/gateway-requests.jsonl'])
    (out/'gateway-requests.jsonl').write_text(requests,encoding='utf-8')
except subprocess.CalledProcessError:
    pass  # Historical discoveries predate request-start observation.
data=json.loads((out/('generated-samples'+suffix+'.json')).read_text(encoding='utf-8'))
print(json.dumps([{'scale':s['input']['scale'],'status':s['status'],'error':s['error_code'],'latency_ms':s['latency_ms']} for s in data['samples']]))
