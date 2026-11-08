"""Prepare a fresh synthetic test run. Never prints runtime secrets."""
from pathlib import Path
import json, os, subprocess

root = Path(__file__).resolve().parents[1]
backend = root.parent / 'school'
out = root / 'docs/llm001-1/final-v152'
out.mkdir(exist_ok=True)

def call(args, **kwargs):
    return subprocess.run(['docker', 'compose', *args], cwd=backend,
                          encoding='utf-8', capture_output=True, check=True, **kwargs)

fixture = call(['exec', '-T', 'app-test', 'php'],
               input=(root / 'tests/backend/llm0011-fixtures.php').read_text(encoding='utf-8'))
data = json.loads(fixture.stdout)
(out / 'test-fixtures.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
run = data['runId']
env = dict(os.environ, LLM001_MODEL='GigaChat-2-Max', LLM001_QUEUE='llm0011-'+run,
           LLM001_REDIS_PREFIX='llm0011_'+run+'_', LLM001_MAX_TOKENS='8000', LLM001_HTTP_TIMEOUT='240', LLM001_TOTAL_TIMEOUT='360', LLM001_REPAIR_PASSES='2', LLM001_RETRY_AFTER='1200')
call(['-f', 'docker-compose.yml', '-f', str(root / 'tests/backend/llm0011-compose.override.yml'),
      'up', '-d', '--no-deps', 'app-test'], env=env)
call(['exec', '-T', 'app-test', 'php', 'artisan', 'config:cache'])
call(['exec', '-T', 'nginx-test', 'nginx', '-s', 'reload'])
print(json.dumps({'runId': run, 'model': 'GigaChat-2-Max', 'evidence': str(out)}))
