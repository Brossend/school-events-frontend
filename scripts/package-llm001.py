"""Source-only LLM001 deliveries. Secrets are loaded only for scanning, never emitted."""
from pathlib import Path
import hashlib, hmac, io, json, re, sys, zipfile

ROOT=Path(__file__).resolve().parents[1]
BACK=ROOT.parent/'school'
OUT=ROOT/'docs/llm001'
EXCLUDED={'.git','.nuxt','.output','node_modules','vendor','__pycache__','.idea','cache','logs','framework','sessions'}
SECRETS,KEYS=set(),set()
for name in ('.env','.env.testing'):
    for line in (BACK/name).read_text(encoding='utf-8-sig').splitlines():
        if '=' not in line or line.lstrip().startswith('#'):continue
        key,value=line.split('=',1);value=value.strip().strip('\"\'')
        if key=='APP_KEY' and value:KEYS.add(value)
        if re.search(r'PASSWORD|SECRET|TOKEN|API_KEY|APP_KEY|PRIVATE_KEY',key,re.I) and len(value)>7 and value not in {'postgres','password','changeme'} and not value.startswith('${'):
            SECRETS.add(value.encode())
for path in (ROOT/'docs').rglob('*fixture*.json'):
    try:data=json.loads(path.read_text(encoding='utf-8-sig'))
    except (ValueError,UnicodeError):continue
    stage=re.search(r'(fe\d+|llm\d+)',path.as_posix(),re.I)
    if isinstance(data,dict) and data.get('runId') and stage:
        for key in KEYS:SECRETS.add(hmac.new(key.encode(),f'{stage[1].upper()}:{data["runId"]}'.encode(),'sha256').hexdigest().encode())

def scan(data):
    assert not any(value in data for value in SECRETS), 'Known local environment or derived fixture secret'
    assert not re.search(rb'pilot_[A-Za-z0-9]{36}',data), 'One-time invitation token'
    assert not re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----',data), 'Private key'

def allowed(path,root):
    parts=path.relative_to(root).parts
    return (not any(p in EXCLUDED for p in parts)
        and (not path.name.startswith('.env') or path.name in {'.env.example','.env.testing.example'})
        and path.suffix.lower() not in {'.zip','.pem','.key','.pfx','.p12','.pyc'}
        and path.name not in {'release-verification.json','read-only-verification.json','read-only-verification.exit','comparison-tail.txt','phpunit-discovery.log','phpunit-first-failure.log','dev-restored.log'})

def package(root,name,prefix,folders,root_files):
    paths=[root/p for p in root_files if (root/p).is_file()]
    for folder in folders:
        paths.extend(p for p in (root/folder).rglob('*') if p.is_file() and allowed(p,root))
    payload={}
    for path in sorted(set(paths)):
        assert not path.is_symlink(),'Symlink refused'
        rel=path.relative_to(root).as_posix();data=path.read_bytes()
        try:
            scan(data)
            if path.suffix in {'.docx','.pptx'}:
                with zipfile.ZipFile(io.BytesIO(data)) as office:
                    assert office.testzip() is None
                    for entry in office.namelist():scan(office.read(entry))
        except AssertionError:raise RuntimeError('Secret/content scan refused: '+rel) from None
        payload[rel]=data
    if root==BACK:
        for folder in ('bootstrap/cache','storage/app/public','storage/framework/cache/data','storage/framework/sessions','storage/framework/views','storage/logs'):
            payload[folder+'/.gitignore']=b'*\n!.gitignore\n'
    manifest={'files':[{'path':p,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()} for p,data in sorted(payload.items())]}
    payload['LLM001-MANIFEST.json']=json.dumps(manifest,ensure_ascii=False,indent=2).encode()
    archive=ROOT/name
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for rel,data in payload.items():
            info=zipfile.ZipInfo(prefix+'/'+rel,date_time=(2026,10,30,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
            z.writestr(info,data)
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        assert len(z.namelist())==len(set(n.casefold() for n in z.namelist()))
        for row in manifest['files']:assert hashlib.sha256(z.read(prefix+'/'+row['path'])).hexdigest()==row['sha256']
    digest=hashlib.sha256(archive.read_bytes()).hexdigest()
    archive.with_suffix('.zip.sha256').write_text(f'{digest}  {name}\n',encoding='ascii')
    return {'file':name,'bytes':archive.stat().st_size,'files':len(payload),'sha256':digest,'crc':'PASS','manifest':'PASS','secretScan':'PASS'}

def main():
    for name in ('phpunit','pint','json-schema','typecheck','eslint','vitest','build'):
        assert (OUT/(name+'.exit')).read_text(encoding='utf-8-sig').strip()=='0',name+' not passing'
    assert (OUT/'live-http.json').is_file(), 'Live evidence missing'
    assert json.loads((OUT/'live-http.json').read_text(encoding='utf-8-sig'))['completed'], 'Live acceptance is incomplete; do not package it as passing'
    assert (BACK/'docs/LLM-001-review.md').is_file(), 'Review missing'
    for name in ('revalidate','live-correction','redelivery','live-provenance-selection'):
        assert (OUT/(name+'.exit')).read_text(encoding='utf-8-sig').strip()=='0',name+' incomplete'
    assert json.loads((OUT/'live-provenance-selection.json').read_text(encoding='utf-8-sig'))['completed']
    before=json.loads((OUT/'redelivery-before.json').read_text(encoding='utf-8-sig'))
    after=json.loads((OUT/'redelivery-after.json').read_text(encoding='utf-8-sig'))
    assert all(before[k]==after[k] for k in ('gatewayCalls','scenarios','revisions','generationRuns','comparisons'))
    assert all(row['unchanged'] for row in json.loads((OUT/'core-contract-hashes.json').read_text()))
    restored=json.loads((OUT/'runtime-restored.json').read_text(encoding='utf-8-sig'))
    assert restored['provider']=='mock' and restored['queue']=='sync'
    assert json.loads((OUT/'production-smoke.json').read_text(encoding='utf-8-sig'))['status']==200
    frontend=package(ROOT,'school-events-frontend-llm001.zip','school-events-frontend',('app','public','scripts','tests','docs'),
        ('package.json','package-lock.json','README.md','nuxt.config.ts','tsconfig.json','eslint.config.mjs','vitest.config.ts','vitest.live.config.ts','.gitignore','.nvmrc','.node-version','.env.example'))
    backend=package(BACK,'school-backend-llm001.zip','school-backend',('app','bootstrap','config','database','docker','docs','public','resources','routes','scripts','tests'),
        ('artisan','composer.json','composer.lock','docker-compose.yml','phpunit.xml','README.md','.env.example','.env.testing.example','.gitignore','.editorconfig','package.json','vite.config.js'))
    result={'status':'PENDING INDEPENDENT REVIEW','archives':[backend,frontend],'knownSecretsScanned':len(SECRETS)}
    (OUT/'release-verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result,indent=2))

if __name__=='__main__':main()
