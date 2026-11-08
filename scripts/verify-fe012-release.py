"""Read-only verification of both final FE012 archives; never extracts them."""
from pathlib import Path, PurePosixPath
import hashlib, json, runpy, zipfile

ROOT=Path(__file__).resolve().parents[1]
gate=runpy.run_path(str(ROOT/'scripts/package-fe012.py'))
receipt=json.loads((ROOT/'docs/fe012/release-verification.json').read_text(encoding='utf-8'))
assert receipt['status']=='PENDING INDEPENDENT FINAL ACCEPTANCE'
checks=[]
for item in receipt['archives']:
    file=ROOT/item['file']; digest=hashlib.sha256(file.read_bytes()).hexdigest()
    assert digest==item['sha256']
    assert file.with_suffix('.zip.sha256').read_text(encoding='ascii').split()[0]==digest
    with zipfile.ZipFile(file) as z:
        assert z.testzip() is None
        names=z.namelist(); assert len(names)==len(set(name.casefold() for name in names))
        prefix=names[0].split('/')[0]+'/'
        manifest=json.loads(z.read(prefix+'FE012-MANIFEST.json'))
        assert len(manifest['files'])+1==len(names)
        for row in manifest['files']:
            rel=PurePosixPath(row['path']); assert not rel.is_absolute() and '..' not in rel.parts
            assert not any(part in {'.git','.nuxt','.output','node_modules','vendor'} for part in rel.parts)
            assert not rel.name.startswith('.env') or rel.name in {'.env.example','.env.testing.example'}
            data=z.read(prefix+str(rel)); assert len(data)==row['bytes']
            assert hashlib.sha256(data).hexdigest()==row['sha256']; gate['scan'](data)
        if prefix=='school-events-frontend/':
            for required in ('package.json','package-lock.json','docs/FE-012-review.md','docs/FE-012-launch.md','docs/fe012/openapi.yaml','tests/fe012-integration.test.ts','docs/fe012/production-smoke.json'):
                assert prefix+required in names
            for name in ('http-full-stack','faults'):
                assert json.loads(z.read(prefix+'docs/fe012/evidence/'+name+'.json'))['completed']
            rows=json.loads(z.read(prefix+'docs/fe012/screenshots/metadata.json'))
            assert len(rows)==68 and len({r['state'] for r in rows})==17
            for row in rows:
                assert row['scroll']<=row['client'] and all(i['loaded'] for i in row['icons'])
                assert prefix+'docs/fe012/screenshots/'+row['file'] in names
        else:
            for required in ('public/index.php','artisan','composer.json','composer.lock','database/seeders/DatabaseSeeder.php','bootstrap/cache/.gitignore','storage/framework/views/.gitignore'):
                assert prefix+required in names
            for row in json.loads((ROOT/'docs/fe012/backend-file-hashes.json').read_text(encoding='utf-8')):
                assert hashlib.sha256(z.read(prefix+row['path'])).hexdigest()==row['sha256']
    checks.append({'file':file.name,'sha256':digest,'files':len(names),'result':'PASS'})
report={'status':'PENDING INDEPENDENT FINAL ACCEPTANCE','readOnlyVerification':checks}
print(json.dumps(report,indent=2))
