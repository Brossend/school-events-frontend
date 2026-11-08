"""Independent ZIP inspection. Secret values stay in process memory and are never printed."""
from pathlib import Path
import hashlib
import io
import hmac
import json
import re
import zipfile

root = Path(__file__).resolve().parents[1]
archive = root / 'school-events-frontend-fe009.zip'
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
    for stage in ('fe004', 'fe005', 'fe006', 'fe007', 'fe008', 'fe009'):
        fixture = root / f'docs/{stage}/evidence/test-fixtures.json'
        if fixture.exists():
            run = json.loads(fixture.read_text(encoding='utf-8-sig'))['runId']
            secrets.add(hmac.new(test_key.encode(), f'{stage.upper()}:{run}'.encode(), 'sha256').hexdigest().encode())

def jpeg_size(payload):
    i = 2
    while i < len(payload):
        if payload[i] != 255:
            break
        while payload[i] == 255:
            i += 1
        marker = payload[i]
        i += 1
        if marker in (0xD8,0xD9,0x01) or 0xD0 <= marker <= 0xD7:
            continue
        length = int.from_bytes(payload[i:i+2], 'big')
        if marker in (0xC0,0xC1,0xC2):
            return int.from_bytes(payload[i+5:i+7], 'big'),int.from_bytes(payload[i+3:i+5], 'big')
        i += length
    raise AssertionError('JPEG dimensions not found')

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
    manifest = json.loads(release.read(prefix + 'docs/fe009-release-manifest.json'))
    for entry in manifest['files']:
        assert hashlib.sha256(release.read(prefix + entry['path'])).hexdigest() == entry['sha256'], 'Manifest mismatch'
    checks = json.loads(release.read(prefix + 'docs/fe009/evidence/final-checks.json'))
    for key in ('typecheck','eslint','vitest','productionBuild','http','historicalHttp'):
        assert checks[key]['exitCode'] == 0, f'{key} failed'
    assert checks['vitest']['passed'] >= 345
    http = json.loads(release.read(prefix + 'docs/fe009/evidence/http-events.json'))
    assert http['completed'] and len(http['requests']) == 72 and http['origin'] == 'http://localhost:8001'
    assert http['contour']['database'] == 'school_events_test' and http['contour']['role'] == 'school_test_user'
    assert http['systemWithoutMembership']['status'] == 403
    assert http['provenanceAfterRestore']['error']['status'] == 403
    historical = json.loads(release.read(prefix + 'docs/fe009/evidence/http-historical-signoff.json'))
    assert historical['completed'] and historical['error']['status'] == 409 and historical['currentRevisionSignoff'] is None
    db = json.loads(release.read(prefix + 'docs/fe009/evidence/persistence-verification.json'))
    for field in ('revisionsModerationSignoffsExportsUnchanged','artifactMetadataUnchanged','softDeletedRowRetained','softDeletedRevisionsRetained','provenanceAfterRestoreBlocked'):
        assert db[field] is True
    assert db['database'] == 'school_events_test' and db['role'] == 'school_test_user'
    before = json.loads(release.read(prefix + 'docs/fe009/evidence/before-archive.json'))
    archived = json.loads(release.read(prefix + 'docs/fe009/evidence/after-archive.json'))
    restored = json.loads(release.read(prefix + 'docs/fe009/evidence/after-restore.json'))
    deleted = json.loads(release.read(prefix + 'docs/fe009/evidence/after-delete.json'))
    row = lambda d,i: next(s for s in d['scenarios'] if s['id'] == i)
    sid,uid = http['ids']['signed']['id'],http['ids']['unsigned']['id']
    assert row(before,sid)['revisions'] == row(archived,sid)['revisions'] == row(restored,sid)['revisions']
    assert row(archived,sid)['is_archived'] is True and row(restored,sid)['is_archived'] is False
    assert row(deleted,uid)['deleted_at'] and row(before,uid)['revisions'] == row(deleted,uid)['revisions']
    query = json.loads(release.read(prefix + 'docs/fe009/evidence/verified-query-contract.json'))
    assert query['confirmed'] and set(query['parameters']) == {'q','page','per_page','sort','status','is_archived'}
    metrics = json.loads(release.read(prefix + 'docs/fe009/screenshots/metadata.json'))
    for state in ('list','empty','archive','archive-confirm','restore-confirm','delete-confirm','delete-denied'):
        for width in (1440,768,390,360):
            found = [m for m in metrics if m['state'] == state and m['requested'] == width]
            assert len(found) == 1, f'Missing {state} {width}'
            item = found[0]
            assert abs(item['width']-width) <= 1 and item['scroll'] <= item['width']
            assert item['source'] == 'authenticated-app-test'
            if item.get('dialogWidth') is not None:
                assert item['dialogScroll'] <= item['dialogWidth']
            payload = release.read(prefix + 'docs/fe009/screenshots/' + item['file'])
            assert payload.startswith(b'\xff\xd8') if item['file'].endswith('.jpg') else payload.startswith(b'\x89PNG')
            if item['file'].endswith('.jpg'):
                iw,ih = jpeg_size(payload)
                assert abs((iw/ih)/(item['width']/item['height'])-1) < 0.05, f'Stale capture scale: {item["file"]}'
            assert all(icon['loaded'] for icon in item['icons'])
    for width in (390,360):
        assert any(m['state'] == 'mobile-grid' and m['requested'] == width for m in metrics)
    runtime = json.loads(release.read(prefix + 'docs/fe009/evidence/restored-runtime.json'))
    assert runtime['queueConnection'] == 'sync' and runtime['frontendApiOrigin'] == 'http://localhost:8000'
    for path in ('package.json','package-lock.json','docs/FE-009-review.md','docs/fe009/api-contract.md','docs/fe009/figma-node-inventory.md','tests/fe009.test.ts','tests/events-isolated.live.ts','tests/events-historical.live.ts'):
        assert prefix + path in names

digest = hashlib.sha256(archive.read_bytes()).hexdigest()
assert archive.with_suffix('.zip.sha256').read_text().split()[0] == digest
print(json.dumps({'archive': archive.name, 'sha256': digest, 'entries': len(names), 'bytes': archive.stat().st_size, 'CRC': 'PASS', 'manifest': 'PASS', 'knownSecretScan': 'PASS', 'excludedPaths': 'PASS', 'evidence': 'PASS'}, indent=2))
