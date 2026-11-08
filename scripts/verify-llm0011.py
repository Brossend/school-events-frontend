"""Independent read-only verification of delivered ZIP bytes (no source changes)."""
from pathlib import Path
import hashlib,hmac,io,json,re,zipfile
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/llm001-1/final-v152'
secrets=set();keys=set()
for envname in ('.env','.env.testing'):
    for line in (ROOT.parent/'school'/envname).read_text(encoding='utf-8-sig').splitlines():
        if '=' not in line or line.lstrip().startswith('#'):continue
        name,value=line.split('=',1);value=value.strip().strip('\"\'')
        if name=='APP_KEY' and value:keys.add(value)
        if re.search('PASSWORD|SECRET|TOKEN|API_KEY|APP_KEY|PRIVATE_KEY',name,re.I) and len(value)>7 and value not in ('postgres','password','changeme') and not value.startswith('${'):secrets.add(value.encode())
for p in (ROOT/'docs').rglob('*fixture*.json'):
    try:d=json.loads(p.read_text(encoding='utf-8-sig'))
    except (ValueError,UnicodeError):continue
    stage=re.search(r'(fe\d+|llm\d+)',p.as_posix(),re.I)
    if stage and isinstance(d,dict) and d.get('runId'):
        for key in keys:secrets.add(hmac.new(key.encode(),f'{('LLM0011' if '/llm001-1/' in p.as_posix() else stage[1].upper())}:{d["runId"]}'.encode(),'sha256').hexdigest().encode())
def scan(data):
    assert not any(x in data for x in secrets),'Known secret found'
    assert not re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----',data),'Private key found'
    assert not re.search(rb'pilot_[A-Za-z0-9]{36}',data),'Invitation token found'
result=[]
for filename,prefix in [('school-backend-llm001-1.zip','school'),('school-events-frontend-llm001-1.zip','schoolFrontend')]:
    path=ROOT/filename;digest=hashlib.sha256(path.read_bytes()).hexdigest()
    assert path.with_suffix('.zip.sha256').read_text().split()[0]==digest
    with zipfile.ZipFile(path) as z:
        assert z.testzip() is None,'CRC mismatch'
        names=z.namelist();assert len(names)==len({n.casefold() for n in names})
        manifest=json.loads(z.read(prefix+'/LLM0011-MANIFEST.json'))
        assert set(names)=={prefix+'/'+r['path'] for r in manifest['files']}|{prefix+'/LLM0011-MANIFEST.json'}
        for row in manifest['files']:
            rel=Path(row['path']);assert not rel.is_absolute() and '..' not in rel.parts
            assert not set(rel.parts)&{'.git','node_modules','vendor','.nuxt','.output','__pycache__'}
            assert not rel.name.startswith('.env') or rel.name in ('.env.example','.env.testing.example')
            data=z.read(prefix+'/'+row['path']);assert len(data)==row['bytes']
            assert hashlib.sha256(data).hexdigest()==row['sha256'];scan(data)
            if rel.suffix in ('.docx','.pptx'):
                with zipfile.ZipFile(io.BytesIO(data)) as office:
                    assert office.testzip() is None
                    for n in office.namelist():scan(office.read(n))
        for suffix in ('docs/LLM-001.1-review.md','docs/llm001/live-http.json','docs/llm001/gateway-http.jsonl'):
            assert prefix+'/'+suffix in names
        acceptance=json.loads(z.read(prefix+'/docs/llm001-1/final-v152/live-http.json'))
        outcomes=json.loads(z.read(prefix+'/docs/llm001-1/final-v152/case-outcomes.json'));assert outcomes['executed_cases']==5
        assert outcomes['acceptance_complete'] is acceptance['completed']
        assert {c['case'] for c in outcomes['cases']}=={'class_level','all_school','family_community','universal_vs_personalized','cultural_context'}
        database=json.loads(z.read(prefix+'/docs/llm001-1/final-v152/postgres-live.json'))
        assert database['database']=='school_events_test' and database['role']=='school_test_user'
        run_ids={r['id'] for r in database['generationRuns']}; comparison_ids={c['id'] for c in database['comparisons']}
        assert all(r['prompt_version']=='school-methodist-1.5.2' for r in database['generationRuns'])
        for case in outcomes['cases']:
            assert case.get('generation_run_id') in run_ids or case.get('comparison_id') in comparison_ids

        assert acceptance['observedPromptVersions']==['school-methodist-1.5.2']
        assert acceptance['completed'] is True
        fresh=json.loads(z.read(prefix+'/docs/llm001-1/final-v152/acceptance-readback.json'))
        assert fresh['completed'] and len(fresh['cases'])==5
        for case in fresh['cases']:
            quality=case['quality']
            for q in ([quality] if 'technical_checks' in quality else quality.values()):
                assert q['gate_version']=='quality-2.3.6' and q['technical_checks']=='passed'
                assert q['cultural_coverage']['whole_document_verified'] is False
        assert json.loads(z.read(prefix+'/docs/llm001-1/final-v152/postgres-live-before-revoke.json'))['teacherSignoffs']==0
        assert all(c['result']['quality_review']['B']['cultural_coverage']['whole_document_verified'] is False for c in acceptance['comparisons'])
        assert all(s['result']['status']=='completed' and s['result']['provider_name']=='litellm' for s in acceptance['scenarios'])
        assert all(c['result']['status']=='completed' for c in acceptance['comparisons'])
        before=json.loads(z.read(prefix+'/docs/llm001-1/final-v152/redelivery-before.json'))
        after=json.loads(z.read(prefix+'/docs/llm001-1/final-v152/redelivery-after.json'))
        assert all(before[k]==after[k] for k in ('gatewayCalls','gatewayRequests','scenarios','revisions','generationRuns','comparisons'))
        assert before['gatewayRequests']>=7 and after['gatewayRequests']==before['gatewayRequests']
        assert after['queueSize']==0
        assert all(json.loads(line)['transaction_level']==0 for line in z.read(prefix+'/docs/llm001-1/final-v152/gateway-http.jsonl').decode().splitlines())
        for c in json.loads(z.read(prefix+'/docs/llm001-1/final-v152/core-contract-hashes.json')):
            assert c['unchanged']
            if prefix=='school':assert hashlib.sha256(z.read(prefix+'/'+c['path'])).hexdigest()==c['sha256']
        review=z.read(prefix+'/docs/LLM-001.1-review.md').decode('utf-8-sig')
        assert 'PENDING INDEPENDENT REVIEW' in review and '1612' in review and 'блокер' in review.lower()
        for check in ('phpunit','pint','json-schema','typecheck','eslint','vitest','build','redelivery','live-provenance-selection','focused','regression-review'):
            assert z.read(prefix+'/docs/llm001-1/final-v152/'+check+'.exit').decode('utf-8-sig').strip()=='0'
        result.append({'archive':filename,'sha256':digest,'files':len(names),'crc':'PASS','manifest':'PASS','secretScan':'PASS','acceptanceEvidence':'ALL_FIVE_CASES_RECORDED','liveAcceptanceComplete':acceptance['completed']})
receipt={'status':'PENDING INDEPENDENT REVIEW','result':result,'method':'Independent ZIP reader; checked CRC, all bytes against manifest, local/derived secrets, live evidence, unchanged core hashes and review limitations.'}
(OUT/'read-only-verification.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
print(json.dumps(receipt,indent=2))
