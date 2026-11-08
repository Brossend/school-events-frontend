"""Independent ZIP inspection. Secret values stay in process memory and are never printed."""
from pathlib import Path
import hashlib
import hmac
import json
import re
import zipfile

root = Path(__file__).resolve().parents[1]
archive = root / 'school-events-frontend-fe007.zip'
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
    for stage in ('fe004', 'fe005', 'fe006', 'fe007'):
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
    manifest = json.loads(release.read(prefix + 'docs/fe007-release-manifest.json'))
    for entry in manifest['files']:
        assert hashlib.sha256(release.read(prefix + entry['path'])).hexdigest() == entry['sha256'], 'Manifest mismatch'
    checks = json.loads(release.read(prefix + 'docs/fe007/evidence/final-checks.json'))
    for key in ('typecheck', 'eslint', 'vitest', 'productionBuild', 'http'):
        assert checks[key]['exitCode'] == 0, f'{key} did not pass'
    http = json.loads(release.read(prefix + 'docs/fe007/evidence/http-mutations.json'))
    assert http['completed'] is True and len(http['requests']) == 56
    db = json.loads(release.read(prefix + 'docs/fe007/evidence/persistence-verification.json'))
    assert db['originalRevisionUnchanged'] and db['allPreviouslyObservedPayloadsUnchanged']
    assert db['successfulHttpRevisionCount'] == 4 and db['historicalSignoffNotTransferred']
    assert db['database'] == 'school_events_test' and db['role'] == 'school_test_user'
    screenshots = json.loads(release.read(prefix + 'docs/fe007/evidence/screenshots.json'))
    metrics = json.loads(release.read(prefix + 'docs/fe007/evidence/viewport-metrics.json'))
    for state in ('live-view', 'live-editor', 'live-signoff', 'live-confirmed', 'fixture-saving', 'fixture-conflict', 'fixture-p0', 'fixture-p1'):
        for width in (1440, 768, 390, 360):
            found = [s for s in screenshots if s['file'] in {f'{state}-{width}.png', f'{state}-{width}.jpg'}]
            assert len(found) == 1, f'Missing viewport {state} {width}'
            measured = [m for m in metrics if m['state'] == state and m.get('requested') == width]
            assert measured and abs(measured[-1]['viewport'] - width) <= 1, f'Unverified CSS viewport {state} {width}'
            assert measured[-1]['scroll'] <= measured[-1]['viewport'], 'Horizontal overflow'
            item = found[0]
            assert item['origin'] == ('isolated-component-fixture' if state.startswith('fixture-') else 'live-app-test')
            payload = release.read(prefix + 'docs/fe007/evidence/' + item['file'])
            assert payload.startswith(b'\x89PNG') if item['file'].endswith('.png') else payload.startswith(b'\xff\xd8')
    restored = json.loads(release.read(prefix + 'docs/fe007/evidence/restored-test-config.json'))
    assert restored['queueConnection'] == 'sync'
    for path in ('package.json', 'package-lock.json', 'docs/FE-007-review.md', 'docs/fe007/figma-node-inventory.md', 'docs/fe007/openapi.yaml', 'tests/fe007.test.ts'):
        assert prefix + path in names

digest = hashlib.sha256(archive.read_bytes()).hexdigest()
assert archive.with_suffix('.zip.sha256').read_text().split()[0] == digest
print(json.dumps({'archive': archive.name, 'sha256': digest, 'entries': len(names), 'bytes': archive.stat().st_size, 'CRC': 'PASS', 'manifest': 'PASS', 'knownSecretScan': 'PASS', 'excludedPaths': 'PASS', 'evidence': 'PASS'}, indent=2))
