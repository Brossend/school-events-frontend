"""Independent ZIP inspection. Secret values stay in process memory and are never printed."""
from pathlib import Path
import hashlib
import hmac
import json
import re
import zipfile

root = Path(__file__).resolve().parents[1]
archive = root / 'school-events-frontend-fe005.zip'
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
    for stage in ('fe004', 'fe005'):
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
    manifest = json.loads(release.read(prefix + 'docs/fe005-release-manifest.json'))
    for entry in manifest['files']:
        assert hashlib.sha256(release.read(prefix + entry['path'])).hexdigest() == entry['sha256'], 'Manifest mismatch'
    checks = json.loads(release.read(prefix + 'docs/fe005/evidence/final-checks.json'))
    for key in ('typecheck', 'eslint', 'vitest', 'productionBuild', 'http'):
        assert checks[key]['exitCode'] == 0, f'{key} did not pass'
    http = json.loads(release.read(prefix + 'docs/fe005/evidence/http-mutations.json'))
    assert http['completed'] is True and len(http['created']) == 3
    db = json.loads(release.read(prefix + 'docs/fe005/evidence/persistence-verification.json'))
    assert db['allIdsPersisted'] and db['newGenerationRuns'] == 0
    for step in range(1, 6):
        for width in (1440, 768, 390, 360):
            assert release.read(prefix + f'docs/fe005/evidence/step-{step}-{width}.png').startswith(b'\x89PNG')
    for path in ('package.json', 'package-lock.json', 'docs/FE-005-review.md'):
        assert prefix + path in names

digest = hashlib.sha256(archive.read_bytes()).hexdigest()
assert archive.with_suffix('.zip.sha256').read_text().split()[0] == digest
print(json.dumps({'archive': archive.name, 'sha256': digest, 'entries': len(names), 'bytes': archive.stat().st_size, 'CRC': 'PASS', 'manifest': 'PASS', 'knownSecretScan': 'PASS', 'excludedPaths': 'PASS', 'evidence': 'PASS'}, indent=2))
