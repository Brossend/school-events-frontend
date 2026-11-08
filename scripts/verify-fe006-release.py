"""Independent ZIP inspection. Secret values stay in process memory and are never printed."""
from pathlib import Path
import hashlib
import hmac
import json
import re
import zipfile

root = Path(__file__).resolve().parents[1]
archive = root / 'school-events-frontend-fe006.zip'
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
    for stage in ('fe004', 'fe005', 'fe006'):
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
    manifest = json.loads(release.read(prefix + 'docs/fe006-release-manifest.json'))
    for entry in manifest['files']:
        assert hashlib.sha256(release.read(prefix + entry['path'])).hexdigest() == entry['sha256'], 'Manifest mismatch'
    checks = json.loads(release.read(prefix + 'docs/fe006/evidence/final-checks.json'))
    for key in ('typecheck', 'eslint', 'vitest', 'productionBuild', 'http'):
        assert checks[key]['exitCode'] == 0, f'{key} did not pass'
    http = json.loads(release.read(prefix + 'docs/fe006/evidence/http-mutations.json'))
    assert http['completed'] is True and len(http['requests']) == 37
    db = json.loads(release.read(prefix + 'docs/fe006/evidence/persistence-verification.json'))
    assert db['httpIdsPersisted'] and db['oneRunPerRequest'] and db['oneRevisionVersion1Each']
    assert db['runs'] == 4 and db['scenarios'] == 3 and db['statuses'] == {'completed': 3, 'failed': 1}
    screenshots = json.loads(release.read(prefix + 'docs/fe006/evidence/screenshots.json'))
    for state in ('live-queued', 'live-failed', 'live-completed', 'live-scenario', 'fixture-running', 'fixture-timed-out'):
        for width in (1440, 768, 390, 360):
            found = [s for s in screenshots if s['file'] in {f'{state}-{width}.png', f'{state}-{width}.jpg'}]
            # Browser image excludes the 15px native scrollbar on overflowing pages.
            assert len(found) == 1 and width - 15 <= found[0]['width'] <= width, f'Missing viewport {state} {width}'
            item = found[0]
            assert item['origin'] == ('isolated-component-fixture' if state.startswith('fixture-') else 'live-app-test')
            payload = release.read(prefix + 'docs/fe006/evidence/' + item['file'])
            assert payload.startswith(b'\x89PNG') if item['file'].endswith('.png') else payload.startswith(b'\xff\xd8')
    restored = json.loads(release.read(prefix + 'docs/fe006/evidence/restored-test-config.json'))
    assert restored['queueConnection'] == 'sync'
    for path in ('package.json', 'package-lock.json', 'docs/FE-006-review.md', 'docs/fe006/figma-node-inventory.md', 'docs/fe006/openapi.yaml', 'tests/fe006.test.ts'):
        assert prefix + path in names

digest = hashlib.sha256(archive.read_bytes()).hexdigest()
assert archive.with_suffix('.zip.sha256').read_text().split()[0] == digest
print(json.dumps({'archive': archive.name, 'sha256': digest, 'entries': len(names), 'bytes': archive.stat().st_size, 'CRC': 'PASS', 'manifest': 'PASS', 'knownSecretScan': 'PASS', 'excludedPaths': 'PASS', 'evidence': 'PASS'}, indent=2))
