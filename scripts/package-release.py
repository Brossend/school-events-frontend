"""Create and verify an allow-listed source release, without build/cache/secrets."""
from pathlib import Path
import hashlib
import json
import zipfile
import sys

ROOT = Path(__file__).resolve().parents[1]
STAGE = sys.argv[1] if len(sys.argv) > 1 else 'fe001'
if STAGE not in {'fe001', 'fe002', 'fe003', 'fe004', 'fe005', 'fe006', 'fe007', 'fe008', 'fe009', 'fe010', 'fe011'}:
    raise ValueError('Supported release stages: fe001 through fe011')
ARCHIVE = ROOT / f'school-events-frontend-{STAGE}.zip'
DIRECTORIES = ('app', 'public', 'scripts', 'tests', 'docs')
ROOT_FILES = (
    'package.json', 'package-lock.json', 'README.md', 'nuxt.config.ts',
    'tsconfig.json', 'eslint.config.mjs', 'vitest.config.ts',
    'vitest.live.config.ts', '.gitignore', '.nvmrc', '.node-version', '.env.example',
)
EXCLUDED = {'.git', '.nuxt', '.output', 'node_modules', '__pycache__', '.idea'}


def permitted(path):
    relative = path.relative_to(ROOT)
    return not any(part in EXCLUDED for part in relative.parts) and (
        not path.name.startswith('.env') or path.name == '.env.example'
    ) and path.suffix.lower() not in {'.zip', '.pem', '.key', '.pfx', '.p12'}


files = [ROOT / name for name in ROOT_FILES]
for directory in DIRECTORIES:
    files.extend(p for p in (ROOT / directory).rglob('*') if p.is_file() and permitted(p))
files = sorted(set(files))
if any(p.is_symlink() for p in files):
    raise RuntimeError('Release inputs must not contain symlinks')
manifest = ROOT / f'docs/{STAGE}-release-manifest.json'
files = [p for p in files if p != manifest]
entries = [dict(path=p.relative_to(ROOT).as_posix(), bytes=p.stat().st_size,
                sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in files]
manifest.write_text(json.dumps({'files': entries}, ensure_ascii=False, indent=2), encoding='utf-8')
files.append(manifest)

with zipfile.ZipFile(ARCHIVE, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as output:
    for path in files:
        if not permitted(path):
            raise RuntimeError(f'Forbidden release input: {path.name}')
        output.write(path, 'school-events-frontend/' + path.relative_to(ROOT).as_posix())

with zipfile.ZipFile(ARCHIVE) as release:
    if release.testzip() is not None:
        raise RuntimeError('ZIP integrity check failed')
    names = set(release.namelist())
    review = {'fe001': 'docs/FE-001-final-review.md', 'fe002': 'docs/FE-002-review.md', 'fe003': 'docs/FE-003-review.md', 'fe004': 'docs/FE-004-review.md', 'fe005': 'docs/FE-005-review.md', 'fe006': 'docs/FE-006-review.md', 'fe007': 'docs/FE-007-review.md', 'fe008': 'docs/FE-008-review.md', 'fe009': 'docs/FE-009-review.md', 'fe010': 'docs/FE-010-review.md', 'fe011': 'docs/FE-011-review.md'}[STAGE]
    for required in ('package.json', 'package-lock.json', review):
        if 'school-events-frontend/' + required not in names:
            raise RuntimeError(f'Missing required input: {required}')
    for entry in entries:
        actual = hashlib.sha256(release.read('school-events-frontend/' + entry['path'])).hexdigest()
        if actual != entry['sha256']:
            raise RuntimeError(f"Content hash mismatch: {entry['path']}")

digest = hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()
ARCHIVE.with_suffix('.zip.sha256').write_text(f'{digest}  {ARCHIVE.name}\n', encoding='ascii')
print(json.dumps({'archive': str(ARCHIVE), 'files': len(files), 'bytes': ARCHIVE.stat().st_size,
                  'sha256': digest, 'integrity': 'PASS'}, indent=2))
