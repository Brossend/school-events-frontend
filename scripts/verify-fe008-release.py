"""Independent ZIP inspection. Secret values stay in process memory and are never printed."""
from pathlib import Path
import hashlib
import io
import hmac
import json
import re
import zipfile

root = Path(__file__).resolve().parents[1]
archive = root / 'school-events-frontend-fe008.zip'
backend = root.parent / 'school'
secrets = set()
test_key = None
for name in ('.env', '.env.testing'):
    path = backend / name
    if not path.exists():
        continue
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        if '=' not in line or line.lstrip().startswith('#'):
            continue
        key, value = line.split('=', 1)
        value = value.strip().strip('"\'')
        if name == '.env.testing' and key == 'APP_KEY':
            test_key = value
        # Public local defaults also occur as service names in historical docs.
        public_default = key == 'DB_PASSWORD' and value in {'postgres', 'password', 'changeme'}
        if re.search(r'PASSWORD|SECRET|TOKEN|APP_KEY', key) and len(value) >= 8 and not value.startswith('${') and not public_default:
            secrets.add(value.encode())
if test_key:
    for stage in ('fe004', 'fe005', 'fe006', 'fe007', 'fe008'):
        fixture = root / f'docs/{stage}/evidence/test-fixtures.json'
        if fixture.exists():
            run = json.loads(fixture.read_text(encoding='utf-8-sig'))['runId']
            secrets.add(hmac.new(test_key.encode(), f'{stage.upper()}:{run}'.encode(), 'sha256').hexdigest().encode())

with zipfile.ZipFile(archive) as release:
    assert release.testzip() is None, 'CRC failed'
    names = release.namelist()
    assert len(names) == len(set(names)), 'Duplicate ZIP entries'
    prefix = 'school-events-frontend/'
    for name in names:
        path = Path(name)
        assert name.startswith(prefix) and '..' not in path.parts, 'Unsafe path'
        assert not set(path.parts) & {'node_modules', '.git', '.nuxt', '.output', '.idea'}, 'Forbidden directory'
        assert not path.name.startswith('.env') or path.name == '.env.example', 'Private environment included'
        assert path.suffix.lower() not in {'.pem', '.key', '.pfx', '.p12', '.zip'}, 'Forbidden file'
        payload = release.read(name)
        assert not any(value in payload for value in secrets), f'Secret detected in {name}'
    manifest = json.loads(release.read(prefix + 'docs/fe008-release-manifest.json'))
    for entry in manifest['files']:
        assert hashlib.sha256(release.read(prefix + entry['path'])).hexdigest() == entry['sha256'], 'Manifest mismatch'
    checks = json.loads(release.read(prefix + 'docs/fe008/evidence/final-checks.json'))
    for key in ('typecheck', 'eslint', 'vitest', 'productionBuild', 'http'):
        assert checks[key]['exitCode'] == 0, f'{key} failed'
    http = json.loads(release.read(prefix + 'docs/fe008/evidence/http-exports.json'))
    assert http['completed'] and http['origin'] == 'http://localhost:8001'
    assert http['contour']['database'] == 'school_events_test' and http['contour']['role'] == 'school_test_user'
    assert len(http['downloads']) == 4 and len(http['denials']) == 7
    assert all(d['error']['status'] == 403 for d in http['denials'])
    recovery = http['lostResponseRecovery']
    assert recovery['sameKey'] and recovery['original'] == recovery['recovered']
    validation = json.loads(release.read(prefix + 'docs/fe008/evidence/document-validation.json'))
    for download in http['downloads']:
        payload = release.read(prefix + download['path'])
        assert hashlib.sha256(payload).hexdigest() == download['sha256']
        assert download['mime'] in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation')
        if download['format'] in ('pdf','print_pack_pdf'):
            assert payload.startswith(b'%PDF-')
        else:
            with zipfile.ZipFile(io.BytesIO(payload)) as inner:
                assert inner.testzip() is None and '[Content_Types].xml' in inner.namelist()
                if download['format'] == 'docx':
                    assert 'word/document.xml' in inner.namelist()
                else:
                    assert len([n for n in inner.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml',n)]) == 5
                    assert len([n for n in inner.namelist() if re.fullmatch(r'ppt/notesSlides/notesSlide\d+\.xml',n)]) == 5

    assert validation['fe008-pptx.pptx']['slides'] == 5 and validation['fe008-pptx.pptx']['notesSlides'] == 5
    assert validation['fe008-pdf.pdf']['pages'] > 0 and validation['fe008-print_pack_pdf.pdf']['pages'] > 0
    metrics = json.loads(release.read(prefix + 'docs/fe008/screenshots/metadata.json'))
    for state in ('selection','waiting','ready','history','blocked','error'):
        for width in (1440,768,390,360):
            item = [m for m in metrics if m['state'] == state and m['requested'] == width]
            assert len(item) == 1 and abs(item[0]['width']-width) <= 1
            assert item[0]['scroll'] <= item[0]['width']
            assert release.read(prefix + f'docs/fe008/screenshots/fixture-{state}-{width}.png').startswith(b'\x89PNG')
    restored = json.loads(release.read(prefix + 'docs/fe008/evidence/restored-test-config.json'))
    assert restored['queueConnection'] == 'sync'
    browser = json.loads(release.read(prefix + 'docs/fe008/evidence/browser-downloads.json'))
    assert len(browser) == 4 and all(b['bytes'] > 100 for b in browser)
    for path in ('package.json','package-lock.json','docs/FE-008-review.md','docs/fe008/figma-node-inventory.md','docs/fe008/openapi.yaml','tests/fe008.test.ts','tests/exports-isolated.live.ts'):
        assert prefix + path in names

digest = hashlib.sha256(archive.read_bytes()).hexdigest()
assert archive.with_suffix('.zip.sha256').read_text().split()[0] == digest
print(json.dumps({'archive': archive.name, 'sha256': digest, 'entries': len(names), 'bytes': archive.stat().st_size, 'CRC': 'PASS', 'manifest': 'PASS', 'knownSecretScan': 'PASS', 'excludedPaths': 'PASS', 'evidence': 'PASS'}, indent=2))
