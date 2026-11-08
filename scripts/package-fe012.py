"""Package both FE012 source deliveries and verify hashes, paths, CRC and secrets."""
from pathlib import Path
import hashlib, hmac, io, json, re, stat, zipfile

ROOT = Path(__file__).resolve().parents[1]
BACK = ROOT.parent / 'school'
OUT = ROOT / 'docs/fe012'
excluded = {'.git','.nuxt','.output','node_modules','vendor','__pycache__','.idea','cache','logs','framework','sessions','testing'}
secrets, keys = set(), set()
for filename in ('.env','.env.testing'):
    for line in (BACK / filename).read_text(encoding='utf-8-sig').splitlines():
        if '=' not in line or line.lstrip().startswith('#'): continue
        key, value = line.split('=',1); value=value.strip().strip('\"\'')
        if key=='APP_KEY' and value: keys.add(value)
        public_default=key in {'DB_PASSWORD','DB_TEST_PASSWORD'} and value in {'postgres','password','changeme'}
        if re.search('PASSWORD|SECRET|TOKEN|APP_KEY|PRIVATE_KEY',key,re.I) and len(value)>7 and not value.startswith('${') and not public_default:
            secrets.add(value.encode())
runs=set()
for fixture in (ROOT/'docs').rglob('*fixture*.json'):
    try: data=json.loads(fixture.read_text(encoding='utf-8-sig'))
    except (ValueError,UnicodeError): continue
    stage=re.search(r'(fe\d+)',fixture.as_posix(),re.I)
    if stage and isinstance(data,dict) and data.get('runId'): runs.add((stage[1].upper(),data['runId']))
for key in keys:
    for stage,run in runs: secrets.add(hmac.new(key.encode(),f'{stage}:{run}'.encode(),'sha256').hexdigest().encode())

def scan(data):
    assert not any(secret in data for secret in secrets), 'Actual environment/fixture secret detected'
    assert not re.search(rb'pilot_[A-Za-z0-9]{36}',data), 'One-time token detected'
    assert not re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----',data), 'Private key detected'

def allowed(p,root):
    rel=p.relative_to(root)
    return (not any(x in excluded for x in rel.parts)
            and (not p.name.startswith('.env') or p.name in {'.env.example','.env.testing.example'})
            and p.suffix.lower() not in {'.zip','.pem','.key','.pfx','.p12','.pyc'}
            and p.name not in {'release-verification.json','read-only-verification.json','read-only-verification.exit'})

def package(root,name,prefix,dirs,files):
    paths=[root/f for f in files if (root/f).is_file()]
    for folder in dirs:
        paths.extend(p for p in (root/folder).rglob('*') if p.is_file() and allowed(p,root))
    paths=sorted(set(paths))
    manifest=[]; payloads={}
    for path in paths:
        assert not path.is_symlink(), 'Symlink forbidden'
        rel=path.relative_to(root).as_posix(); data=path.read_bytes()
        try: scan(data)
        except AssertionError: raise AssertionError('Secret-scan refusal in '+rel) from None
        if path.suffix in {'.docx','.pptx'}:
            with zipfile.ZipFile(io.BytesIO(data)) as doc:
                assert doc.testzip() is None
                for entry in doc.namelist(): scan(doc.read(entry))
        manifest.append({'path':rel,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}); payloads[rel]=data
    if root == BACK:
        for folder in ('bootstrap/cache','storage/app/public','storage/framework/cache/data','storage/framework/sessions','storage/framework/views','storage/logs'):
            rel=folder+'/.gitignore'; data=b'*\n!.gitignore\n'
            payloads[rel]=data
            manifest.append({'path':rel,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
    payloads['FE012-MANIFEST.json']=json.dumps({'files':manifest},ensure_ascii=False,indent=2).encode()
    archive=ROOT/name
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for rel,data in payloads.items(): z.writestr(prefix+'/'+rel,data)
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        assert len(z.namelist())==len(set(n.casefold() for n in z.namelist()))
        for info in z.infolist():
            assert '..' not in Path(info.filename).parts and not info.filename.startswith('/')
            assert not stat.S_ISLNK(info.external_attr>>16)
        for entry in manifest: assert hashlib.sha256(z.read(prefix+'/'+entry['path'])).hexdigest()==entry['sha256']
    digest=hashlib.sha256(archive.read_bytes()).hexdigest()
    archive.with_suffix('.zip.sha256').write_text(f'{digest}  {name}\n',encoding='ascii')
    return {'file':name,'bytes':archive.stat().st_size,'files':len(payloads),'sha256':digest,'crc':'PASS','manifest':'PASS','secretScan':'PASS'}

def main():
    for check in ('typecheck','eslint','vitest','build','phpunit','route-contract','json-schema','http-e2e','faults-e2e','pint'):
        assert (OUT/f'{check}.exit').read_text(encoding='utf-8-sig').strip()=='0', f'{check} not passing'
    assert json.loads((OUT/'response-contract.json').read_text(encoding='utf-8'))['failures']==0
    evidence=json.loads((OUT/'evidence/http-full-stack.json').read_text(encoding='utf-8'))
    for export in evidence['exports']:
        assert export['observed']==['queued','processing','ready']
        assert hashlib.sha256((OUT/'evidence/documents'/export['file']).read_bytes()).hexdigest()==export['sha256']
    front=package(ROOT,'school-events-final-fe012.zip','school-events-frontend',
                  ['app','public','scripts','tests','docs'],
                  ['package.json','package-lock.json','README.md','nuxt.config.ts','tsconfig.json','eslint.config.mjs','vitest.config.ts','vitest.live.config.ts','.gitignore','.nvmrc','.node-version','.env.example'])
    back=package(BACK,'school-backend-integration-fe012.zip','school-backend',
                 ['app','bootstrap','config','database','docker','docs','public','resources','routes','scripts','tests'],
                 ['artisan','composer.json','composer.lock','docker-compose.yml','phpunit.xml','README.md','.env.example','.env.testing.example','.gitignore','.editorconfig','package.json','vite.config.js'])
    result={'status':'PENDING INDEPENDENT FINAL ACCEPTANCE','archives':[front,back],'fixtureRunsScanned':len(runs)}
    (OUT/'release-verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result,indent=2))

if __name__ == '__main__':
    main()
