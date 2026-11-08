"""Validate recorded JSON HTTP responses against the shipped OpenAPI schema."""
from pathlib import Path
import json, re
import yaml
from jsonschema import Draft202012Validator

root = Path(__file__).resolve().parents[1]
spec = yaml.safe_load((root.parent / 'school/docs/openapi.yaml').read_text(encoding='utf-8'))
trace = json.loads((root / 'docs/fe012/evidence/http-full-stack.json').read_text(encoding='utf-8'))['trace']
results, skipped = [], []
for row in trace:
    path = row['path'].split('?')[0]
    match = next(((p, v) for p, v in spec['paths'].items()
                  if re.fullmatch(re.sub(r'\{[^}]+\}', '[^/]+', p), '/api/v1' + path)), None)
    if match is None:
        match = next(((p, v) for p, v in spec['paths'].items()
                      if re.fullmatch(re.sub(r'\{[^}]+\}', '[^/]+', p), path)), None)
    if not match or row.get('response') in (None, '[auth omitted]'):
        skipped.append({'method': row['method'], 'path': path, 'reason': 'no matching operation or body intentionally omitted'})
        continue
    operation = match[1].get(row['method'].lower(), {})
    response = operation.get('responses', {}).get(str(row['status']), {})
    schema = response.get('content', {}).get('application/json', {}).get('schema')
    if not schema:
        skipped.append({'method': row['method'], 'path': path, 'reason': 'no JSON schema for status'})
        continue
    if row['method'] == 'POST' and path == '/pilot/participants' and row['status'] == 201:
        skipped.append({'method': row['method'], 'path': path, 'reason': 'one-time invite_token deliberately redacted; validated by live harness before redaction'})
        continue
    combined = dict(schema, components=spec.get('components', {}))
    errors = [f"{'/'.join(map(str, e.path))}: {e.message}" for e in Draft202012Validator(combined).iter_errors(row['response'])]
    results.append({'method': row['method'], 'path': path, 'status': row['status'], 'errors': errors})
report = {'validated': len(results), 'failures': sum(bool(r['errors']) for r in results), 'results': results, 'skipped': skipped,
          'scope': 'Recorded response bodies only; omitted authentication, binary bodies and undocumented error schemas are explicitly excluded. Generic object schemas do not verify nested fields.'}
(root / 'docs/fe012/response-contract.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({k: report[k] for k in ('validated', 'failures')}))
raise SystemExit(bool(report['failures']))

