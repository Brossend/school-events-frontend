"""Read-only FE011 release gate; run only after parent finalizes and packages.

Standard library only. Never extracts files, writes evidence, runs the app,
packages a release, or prints credentials/payloads/exception details.
Reuses the established FE010 path, image and failure-message primitives.
"""
from pathlib import Path, PurePosixPath
import hashlib
import hmac
import io
import json
import re
import runpy
import stat
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
BASE = runpy.run_path(str(ROOT / 'scripts/verify-fe010-release.py'))
ReleaseError = BASE['ReleaseError']
require = BASE['require']
number = BASE['number']
load_json = BASE['load_json']
safe_path = BASE['safe_path']
jpeg_size = BASE['jpeg_size']
ROOT_FILES = BASE['ROOT_FILES']
PREFIX = 'school-events-frontend/'
EVIDENCE = 'docs/fe011/evidence/'
SCREENSHOTS = 'docs/fe011/screenshots/'
STATES = {
    'school-profile', 'school-edit', 'school-errors', 'system-status',
    'catalog-queue', 'source-review', 'evidence-attach',
    'evidence-detach-confirm', 'review-history',
}
WIDTHS = (1440, 768, 390, 360)
EXPECTED_RUN = 'f7b999d3d1'
MIN_TESTS = 588


def secret_values(payloads, backend):
    """All backend env secrets plus HMAC passwords for every saved fixture run."""
    values, keys = set(), set()
    testing_key_found = False
    for filename in ('.env', '.env.testing'):
        path = backend / filename
        require(path.is_file(), 'Backend secret-scan environment unavailable')
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            if '=' not in line or line.lstrip().startswith('#'):
                continue
            key, value = line.split('=', 1)
            key, value = key.strip(), value.strip().strip('"\'')
            if key == 'APP_KEY' and value:
                keys.add(value)
                if filename == '.env.testing':
                    testing_key_found = True
            public_default = key == 'DB_PASSWORD' and value in {'postgres', 'password', 'changeme'}
            if (re.search(r'PASSWORD|SECRET|TOKEN|APP_KEY|PRIVATE_KEY', key, re.I)
                    and value and value.lower() not in {'null', 'false', 'true'}
                    and not value.startswith('${') and not public_default):
                values.add(value.encode('utf-8'))
    require(testing_key_found, 'Fixture HMAC key unavailable')
    fixtures = [(name, data) for name, data in payloads.items()
                if 'fixture' in PurePosixPath(name).name.lower() and name.endswith('.json')]
    fixtures.extend((p.relative_to(ROOT).as_posix(), p.read_bytes())
                    for p in (ROOT / 'docs').rglob('*fixture*.json'))
    runs = set()
    for name, data in fixtures:
        fixture = load_json(data)
        if not isinstance(fixture, dict) or 'runId' not in fixture:
            continue
        stage = re.search(r'(?:^|/)(fe\d+)(?:/|[-_])', name, re.I)
        require(stage is not None and isinstance(fixture['runId'], str) and fixture['runId'],
                'Fixture run identity missing')
        runs.add((stage[1].upper(), fixture['runId']))
    require({'FE010', 'FE011'} <= {stage for stage, _ in runs}, 'Historical/current fixture runs missing')
    for key in keys:
        for stage, run in runs:
            values.add(hmac.new(key.encode('utf-8'), f'{stage}:{run}'.encode('utf-8'),
                                'sha256').hexdigest().encode('ascii'))
    return values, len(runs)


def scan_secrets(data, secrets, nested=False):
    require(not any(value in data for value in secrets)
            and re.search(rb'pilot_[A-Za-z0-9]{36}', data) is None,
            'Secret detected in archive payload')
    require(re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----', data) is None,
            'Private key content detected')
    if nested:
        with zipfile.ZipFile(io.BytesIO(data)) as document:
            require(document.testzip() is None, 'Document ZIP CRC failed')
            for name in document.namelist():
                scan_secrets(document.read(name), secrets)


def contour(value, snapshot=False):
    require(value['database'] == 'school_events_test' and value['environment'] == 'testing'
            and value['role' if snapshot else 'databaseUser'] == 'school_test_user'
            and value['queue'] == 'sync', 'Evidence outside isolated database/role/runtime')


def verify_final_checks(read):
    checks = read(EVIDENCE + 'final-checks.json')
    for key in ('typecheck', 'eslint', 'vitest', 'productionBuild', 'http'):
        require(type(checks[key]['exitCode']) is int and checks[key]['exitCode'] == 0,
                'Final check missing or failed: ' + key)
    require(type(checks['vitest']['passed']) is int and checks['vitest']['passed'] >= MIN_TESTS,
            'Full Vitest regression count below 588')
    runtime = read(EVIDENCE + 'restored-runtime.json')
    require(runtime['queueConnection'] == 'sync'
            and runtime['frontendApiOrigin'] == 'http://localhost:8000', 'Runtime restoration pending')


def verify_evidence(read, payloads, backend):
    validation = read(EVIDENCE + 'validation.json')
    fixture = read(EVIDENCE + 'test-fixtures.json')
    bootstrap = read(EVIDENCE + 'ui-bootstrap.json')
    http = read(EVIDENCE + 'http-admin.json')
    require(validation['completed'] is True and validation['bootstrapCompleted'] is True
            and validation['secretFound'] is False and validation['backendChanged'] == []
            and validation['transportLogCommandStatus'] == 0, 'Live validation incomplete or unsafe')
    require(bootstrap['completed'] is True and http['completed'] is True,
            'Final bootstrap/HTTP E2E incomplete')
    require(validation['runId'] == fixture['runId'] == bootstrap['runId'] == EXPECTED_RUN,
            'Mixed or unexpected FE011 fixture run')
    # Seed receipt deliberately remains completed:false; only final bootstrap is completed.
    for value in (fixture, bootstrap):
        contour(value)
        require(value['origin'] == http['origin'] == 'http://localhost:8001', 'HTTP origin mismatch')
    require(http['probe']['environment'] == 'testing'
            and http['probe']['database'] == http['probe']['configured_database'] == 'school_events_test',
            'HTTP test-database probe missing')
    trace = http['trace']
    require(type(validation['httpResponses']) is int and len(trace) == validation['httpResponses']
            and len(trace) >= 94, 'HTTP response count incomplete')
    require(all(type(r['status']) is int and 200 <= r['status'] < 600 for r in trace),
            'Invalid HTTP trace status')
    statuses = {r['status'] for r in trace}
    require({200, 201, 202, 204, 401, 403, 404, 409, 422} <= statuses
            and set(validation['statuses']) == statuses, 'HTTP success/negative-path evidence missing')
    require(http['invalidDraft']['persistedUnchanged'] is True, 'Invalid profile changed persisted state')
    require(http['queueAllPagination']['supportedByActualHTTP'] is True
            and bootstrap['queueAllHTTPProven'] is True, 'Queue all not proven by HTTP')
    require(http['sourceAmendmentAudit']['invalidationEventReturned'] is False
            and bootstrap['integrationLimits']['amendmentInvalidationAuditReturned'] is False
            and validation['limitations']['amendmentInvalidationAuditReturned'] is False,
            'Live amendment-audit discrepancy changed; re-review required')
    ordering = http['latestReviewOrdering']
    require(ordering['sqlOrder'] == 'reviewed_at DESC, id DESC'
            and ordering['sqlReviewId'] == ordering['queueReviewId'] == ordering['reviewHistoryId']
            == bootstrap['latestReviewId'], 'Latest source-review ordering mismatch')
    reviews = http['reviews']['data']
    require(reviews and reviews[0]['id'] == bootstrap['latestReviewId'], 'Review history identity mismatch')
    require(http['verification']['data']['status'] == 'passed', 'Scenario verification did not pass')
    final = bootstrap['finalClaim']
    require(final['id'] == bootstrap['claims']['regional66']['primary']
            and final['evidence_records'] and all(r['is_detached'] is True
            and r['effective_status'] == 'unverified' for r in final['evidence_records'])
            and final['evidence_audit_events'], 'Detached primary claim or retained audit missing')
    export = next((e for e in http['exportHistoryAfterRevocation']['data']
                   if e['id'] == bootstrap['exportId']), None)
    require(export is not None and export['status'] == 'ready'
            and export['is_downloadable'] is False and export['format'] == 'docx',
            'Ready DOCX must remain unavailable after provenance revocation')
    doc = payloads[EVIDENCE + 'documents/fe011-own-scenario.docx']
    require(len(doc) == export['artifact']['file_size_bytes']
            and hashlib.sha256(doc).hexdigest() == export['artifact']['sha256_hash'],
            'Downloaded DOCX differs from real artifact receipt')
    with zipfile.ZipFile(io.BytesIO(doc)) as document:
        require(document.testzip() is None and 'word/document.xml' in document.namelist(),
                'Downloaded DOCX invalid')
    download_path = '/export-jobs/' + bootstrap['exportId'] + '/download'
    download_statuses = [r['status'] for r in trace if r['method'] == 'GET' and r['path'] == download_path]
    require(200 in download_statuses and download_statuses[-1] == 403,
            'Real DOCX download then live revocation denial not proven')
    scenario_path = '/scenarios/' + bootstrap['scenarioId'] + '/revisions/' + str(bootstrap['revisionVersion'])
    require(any(r['method'] == 'POST' and r['path'] == scenario_path + '/signoff'
                and r['status'] == 200 for r in trace)
            and any(r['method'] == 'POST' and r['path'] == scenario_path + '/exports'
                    and r['status'] == 403 for r in trace)
            and any(r['method'] == 'PATCH' and r['path'] == scenario_path and r['status'] == 409
                    for r in trace), 'Signed/export-revoked/stale-lock checkpoints missing')
    verify_database(read, fixture, bootstrap, http, validation)
    hashes = read(EVIDENCE + 'backend-readonly-sha256.json')
    require(len(hashes) >= 11, 'Backend source hash inventory incomplete')
    for name, expected in hashes.items():
        relative = PurePosixPath(name)
        require(not relative.is_absolute() and '\\' not in name and ':' not in name
                and all(part not in ('', '.', '..') for part in name.split('/')),
                'Unsafe backend hash path')
        path = backend / name
        require(path.is_file() and path.resolve().is_relative_to(backend.resolve())
                and re.fullmatch(r'[0-9a-f]{64}', expected)
                and hashlib.sha256(path.read_bytes()).hexdigest() == expected,
                'Backend source changed from read-only receipt')


def verify_database(read, fixture, bootstrap, http, validation):
    snapshots = {}
    schools = {s['id'] for s in fixture['schools'].values()}
    for stage in ('before', 'verified', 'amended', 'reverified', 'signed-export', 'after'):
        value = read(EVIDENCE + 'postgres-' + stage + '.json')
        contour(value, snapshot=True)
        require(value['runId'] == EXPECTED_RUN, 'Mixed PostgreSQL snapshot run')
        tables = value['tables']
        require({s['id'] for s in tables['schools']} == schools, 'PostgreSQL school scope mismatch')
        for rows in tables.values():
            require(len(rows) == len({r['id'] for r in rows}), 'Duplicate PostgreSQL identity')
        snapshots[stage] = tables
    before, after = snapshots['before'], snapshots['after']
    diff = read(EVIDENCE + 'postgres-diff.json')
    require(diff == http['postgresDiff'] == validation['postgresDiff'], 'PostgreSQL diff receipts disagree')
    for table, counts in diff.items():
        require(counts == {'before': len(before[table]), 'after': len(after[table]),
                           'delta': len(after[table]) - len(before[table])}, 'PostgreSQL count delta mismatch')
    require({'source_reviews', 'cultural_claim_sources', 'cultural_claim_evidence_audit_events',
             'scenarios', 'export_jobs'} <= set(diff), 'Required persistence deltas missing')
    for table in ('cultural_claim_sources', 'cultural_claim_evidence_audit_events', 'source_reviews'):
        require({r['id'] for r in before[table]} <= {r['id'] for r in after[table]},
                'Append-only persistence identities removed')
    prior_audits = {r['id']: r for r in before['cultural_claim_evidence_audit_events']}
    later_audits = {r['id']: r for r in after['cultural_claim_evidence_audit_events']}
    require(all(later_audits[key] == row for key, row in prior_audits.items()), 'Prior audit content changed')
    primary = bootstrap['claims']['regional66']['primary']
    sibling = bootstrap['claims']['regional66']['sibling']
    source = bootstrap['sources']['regional66']
    def evidence(stage, claim):
        found = [r for r in snapshots[stage]['cultural_claim_sources']
                 if r['cultural_claim_id'] == claim and r['event_source_id'] == source]
        require(len(found) == 1, 'Owned claim/source evidence identity missing')
        return found[0]
    for stage, status in (('verified', 'verified_authentic'), ('amended', 'unverified'),
                          ('reverified', 'verified_authentic'), ('signed-export', 'verified_authentic')):
        require(evidence(stage, primary)['verification_status'] == status
                and evidence(stage, primary)['is_detached'] is False, 'Evidence verification transition invalid')
    detached = evidence('after', primary)
    require(detached['is_detached'] is True and detached['verification_status'] == 'unverified'
            and detached['verified_by_user_id'] is None and detached['verified_at'] is None
            and detached['detached_at'] and detached['detached_by_user_id']
            and evidence('after', sibling)['verification_status'] == 'verified_authentic'
            and evidence('after', sibling)['is_detached'] is False, 'Detachment or sibling isolation invalid')
    require(any(r['cultural_claim_source_id'] == detached['id'] and r['action'] == 'detached'
                for r in after['cultural_claim_evidence_audit_events']), 'Detachment audit missing')
    for stage in ('signed-export', 'after'):
        require(any(r['id'] == bootstrap['scenarioId'] and r['current_revision_id'] == bootstrap['revisionId']
                    and r['optimistic_lock_version'] == bootstrap['revisionVersion']
                    for r in snapshots[stage]['scenarios']), 'Persisted scenario/revision mismatch')
        require(any(r['id'] == bootstrap['exportId'] and r['status'] == 'ready' and r['format'] == 'docx'
                    and r['revision_id'] == bootstrap['revisionId']
                    for r in snapshots[stage]['export_jobs']), 'Ready export artifact not retained')
    profile = bootstrap['expectedStates']['profile']
    persisted = next(r for r in after['schools'] if r['id'] == profile['id'])
    require(all(persisted[key] == profile[key] for key in
                ('name', 'short_name', 'city', 'inn', 'settings', 'region_code')), 'Persisted profile mismatch')


def image_size(data, suffix):
    if suffix in {'.jpg', '.jpeg'}:
        return jpeg_size(data)
    require(suffix == '.png' and len(data) > 32 and data[:8] == b'\x89PNG\r\n\x1a\n'
            and data[12:16] == b'IHDR' and data[-8:-4] == b'IEND', 'Screenshot image invalid')
    return int.from_bytes(data[16:20], 'big'), int.from_bytes(data[20:24], 'big')


def verify_screenshots(read, payloads):
    metrics = read(SCREENSHOTS + 'metadata.json')
    require(isinstance(metrics, list), 'Screenshot metadata must be a list')
    used = set()
    for state in sorted(STATES):
        for width in WIDTHS:
            found = [m for m in metrics if m['state'] == state and m['requested'] == width]
            require(len(found) == 1, f'Missing/duplicate screenshot: {state} {width}')
            item = found[0]
            require(item['source'] == 'real-api-app-test' and item['fullPage'] is True
                    and item['syntheticLabel'] is True and item['secretVisible'] is False,
                    'Screenshot provenance/full-page/secret/label invalid')
            require(number(item['width']) and abs(item['width'] - width) <= 1
                    and number(item['scroll']) and 0 < item['scroll'] <= item['width']
                    and number(item['documentHeight']) and item['documentHeight'] > 0,
                    'Screenshot viewport/height/horizontal overflow invalid')
            filename = SCREENSHOTS + item['file']
            safe_path(filename)
            require(filename.startswith(SCREENSHOTS) and filename not in used, 'Screenshot file reused')
            used.add(filename)
            iw, ih = image_size(payloads[filename], PurePosixPath(filename).suffix.lower())
            require(iw > 0 and ih > 0 and abs((iw / ih) /
                    (item['width'] / item['documentHeight']) - 1) < 0.05,
                    'Stale screenshot frame/aspect ratio: ' + state + ' ' + str(width))
            if item.get('dialogWidth') is not None:
                require(number(item['dialogWidth']) and item['dialogWidth'] > 0
                        and number(item['dialogScroll']) and 0 < item['dialogScroll'] <= item['dialogWidth'],
                        'Dialog horizontal overflow')
            # Text-only tablet navigation can legitimately have no visible icons.
            require(isinstance(item['icons'], list) and (width == 768 or item['icons']),
                    'Visible icon evidence missing')
            for icon in item['icons']:
                require(icon['loaded'] is True and number(icon['width']) and icon['width'] > 0
                        and number(icon['height']) and icon['height'] > 0, 'Visible icon failed to load')
                src = icon['src']
                require(src.startswith('/') and not src.startswith('//'), 'Nonlocal visible icon')
                safe_path('public' + src)
                require(payloads.get('public' + src), 'Visible icon missing from archive')
    for screen in read('docs/fe011/figma/asset-manifest.json'):
        for path in (screen['context'], screen['metadata'], screen['screenshot']):
            require(payloads.get(path), 'Figma reference missing')
        for asset in screen['assets']:
            require(payloads.get(asset['path']), 'Figma asset missing')


def verify(archive, backend):
    require(archive.is_file(), 'FE011 archive not yet available')
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    sidecar = archive.with_suffix('.zip.sha256').read_text(encoding='utf-8-sig').strip().split()
    require(len(sidecar) == 2 and sidecar[0] == digest and sidecar[1] == archive.name,
            'External SHA-256/filename mismatch')
    with zipfile.ZipFile(archive) as release:
        require(release.testzip() is None, 'ZIP CRC failed')
        names = release.namelist()
        require(len(names) == len(set(names)), 'Duplicate ZIP entries')
        payloads = {}
        for info in release.infolist():
            require(info.filename.startswith(PREFIX) and not info.is_dir(), 'Unexpected ZIP root/directory')
            require(not stat.S_ISLNK(info.external_attr >> 16), 'ZIP symlink forbidden')
            path = safe_path(info.filename[len(PREFIX):])
            payloads[path] = release.read(info)
    read = lambda name: load_json(payloads[name])
    manifest_name = 'docs/fe011-release-manifest.json'
    entries = read(manifest_name)['files']
    require(len(entries) == len({e['path'] for e in entries})
            and {e['path'] for e in entries} == set(payloads) - {manifest_name},
            'Manifest must cover every ZIP payload exactly once')
    for entry in entries:
        data = payloads[entry['path']]
        require(type(entry['bytes']) is int and entry['bytes'] == len(data)
                and hashlib.sha256(data).hexdigest() == entry['sha256'], 'Manifest size/hash mismatch')
    secrets, runs = secret_values(payloads, backend)
    for name, data in payloads.items():
        scan_secrets(data, secrets, nested=PurePosixPath(name).suffix.lower() == '.docx')
    for name in ROOT_FILES | {
        'docs/FE-011-review.md', 'docs/fe011/school-contract.md', 'docs/fe011/catalog-contract.md',
        'docs/fe011/Figma-inventory.md', 'docs/fe011/independent-code-review.md',
        'docs/fe011/evidence/README.md', 'docs/fe011/evidence/http-pagination-discovery.json',
        'docs/fe011/evidence/http-amendment-discovery.json', 'docs/fe011/evidence/nginx-own-http.log',
        'tests/admin-isolated.live.ts', 'scripts/verify-fe010-release.py', 'scripts/verify-fe011-release.py',
        'tests/fe011-school.test.ts', 'tests/fe011-catalog-data.test.ts',
        'tests/fe011-review-regressions.test.ts',
        'tests/fe011-admin-workflows.test.ts', 'tests/backend/fe011-fixtures.php', 'tests/backend/fe011-state.php',
    }:
        require(payloads.get(name), 'Required release input missing')
    review = payloads['docs/FE-011-review.md'].decode('utf-8-sig')
    required_status = 'PENDING INDEPENDENT REVIEW'
    require(required_status in review, 'Required independent-review status missing')
    require(not re.search(r'\bDRAFT\b|\bPENDING\b|\bTODO\b', review.replace(required_status, '')),
            'Parent final review still draft')
    verify_final_checks(read)
    verify_evidence(read, payloads, backend)
    verify_screenshots(read, payloads)
    return {'archive': archive.name, 'sha256': digest, 'entries': len(names),
            'bytes': archive.stat().st_size, 'fixtureRunsScanned': runs,
            'CRC': 'PASS', 'manifest': 'PASS', 'knownSecretScan': 'PASS',
            'excludedPaths': 'PASS', 'evidence': 'PASS', 'screenshots': 'PASS', 'runtime': 'PASS'}


def main():
    try:
        result = verify(ROOT / 'school-events-frontend-fe011.zip', ROOT.parent / 'school')
    except ReleaseError as error:
        print(json.dumps({'status': 'FAIL', 'reason': str(error)}, ensure_ascii=False))
        return 1
    except Exception:
        print(json.dumps({'status': 'FAIL', 'reason': 'Required input missing, corrupt or wrong shape'}))
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main())
