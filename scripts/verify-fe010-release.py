"""Read-only FE010 ZIP gate. Never prints payloads, credentials or exception details.

Run with PYTHONUTF8=1 after the parent finalizes evidence and packages fe010.
Uses only the Python standard library; does not extract or modify the archive.
"""
from collections import defaultdict
from pathlib import Path, PurePosixPath
import hashlib
import hmac
import json
import math
import re
import stat
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PREFIX = 'school-events-frontend/'
EVIDENCE = 'docs/fe010/evidence/'
SCREENSHOTS = 'docs/fe010/screenshots/'
ROOT_FILES = {
    'package.json', 'package-lock.json', 'README.md', 'nuxt.config.ts',
    'tsconfig.json', 'eslint.config.mjs', 'vitest.config.ts',
    'vitest.live.config.ts', '.gitignore', '.nvmrc', '.node-version', '.env.example',
}
DIRECTORIES = {'app', 'public', 'scripts', 'tests', 'docs'}
EXCLUDED = {'.git', '.nuxt', '.output', 'node_modules', '__pycache__', '.idea'}
STATES = {
    'comparison-create', 'comparison-variants', 'comparison-selected', 'participants',
    'questionnaire', 'expert-review', 'no-data', 'incomplete', 'partial-review',
    'completed-synthetic',
}
KPI = {
    'median_relative_time_saving_percent': 60,
    'personalization_choice_percent': 70,
    'manual_edit_under_20_percent_ratio': 70,
    'cultural_context_usage_percent': 60,
    'average_cultural_usefulness_score': 4.5,
    'critical_cultural_errors_count': 0,
}


class ReleaseError(Exception):
    """A fixed, nonsecret validation message safe to show to the caller."""


def require(condition, message):
    if not condition:
        raise ReleaseError(message)


def number(value):
    return type(value) in (int, float) and math.isfinite(value)


def load_json(payload):
    return json.loads(payload.decode('utf-8-sig'))


def safe_path(name):
    path = PurePosixPath(name)
    require(name and not path.is_absolute() and '\\' not in name
            and ':' not in name and all(p not in ('', '.', '..') for p in name.split('/')),
            'Unsafe archive path')
    require(not set(path.parts) & EXCLUDED, 'Excluded directory included')
    require(not path.name.startswith('.env') or path.name == '.env.example',
            'Private environment included')
    require(path.suffix.lower() not in {'.zip', '.pem', '.key', '.pfx', '.p12'},
            'Excluded file included')
    require(len(path.parts) == 1 and name in ROOT_FILES or
            len(path.parts) > 1 and path.parts[0] in DIRECTORIES,
            'File outside source allowlist')
    require(not re.search(r'(?:^|/)(?:cookies?(?:[._-]|$)|storageState\.|auth-state\.)', name, re.I),
            'Session material included')
    require(not re.search(r'school-events-frontend-fe\d+\.zip(?:\.|$)', name, re.I),
            'Previous delivery included')
    return name


def secret_values(payloads, backend):
    """Scan all fixture runs, including investigative and historical inputs."""
    values, keys = set(), set()
    for name in ('.env', '.env.testing'):
        path = backend / name
        require(path.is_file(), 'Backend secret-scan environment unavailable')
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            if '=' not in line or line.lstrip().startswith('#'):
                continue
            key, value = line.split('=', 1)
            key, value = key.strip(), value.strip().strip('"\'')
            if key == 'APP_KEY' and name == '.env.testing' and value:
                keys.add(value)
            public_default = key == 'DB_PASSWORD' and value in {'postgres', 'password', 'changeme'}
            if (re.search(r'PASSWORD|SECRET|TOKEN|APP_KEY|PRIVATE_KEY', key, re.I)
                    and value and value.lower() not in {'null', 'false', 'true'}
                    and not value.startswith('${') and not public_default):
                values.add(value.encode('utf-8'))
    require(keys, 'Fixture HMAC key unavailable')
    fixtures = [(name, data) for name, data in payloads.items()
                if 'fixture' in PurePosixPath(name).name.lower() and name.endswith('.json')]
    fixtures.extend((p.relative_to(ROOT).as_posix(), p.read_bytes())
                    for p in (ROOT / 'docs').rglob('*fixture*.json'))
    runs = set()
    for name, data in fixtures:
        fixture = load_json(data)
        if not isinstance(fixture, dict) or 'runId' not in fixture:
            continue
        match = re.search(r'(?:^|/)(fe\d+)(?:/|[-_])', name, re.I)
        require(match is not None and isinstance(fixture['runId'], str) and fixture['runId'],
                'Fixture run identity missing')
        runs.add((match[1].upper(), fixture['runId']))
    require(any(stage == 'FE010' for stage, _ in runs), 'FE010 fixture runs missing')
    for key in keys:
        for stage, run in runs:
            values.add(hmac.new(key.encode('utf-8'), f'{stage}:{run}'.encode('utf-8'),
                                'sha256').hexdigest().encode('ascii'))
    return values, len(runs)


def jpeg_size(data):
    require(len(data) > 100 and data.startswith(b'\xff\xd8') and data.endswith(b'\xff\xd9'),
            'Screenshot must be a nonempty complete JPEG')
    offset = 2
    while offset + 4 <= len(data):
        require(data[offset] == 255, 'Invalid JPEG marker')
        while offset < len(data) and data[offset] == 255:
            offset += 1
        marker = data[offset]
        offset += 1
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            continue
        require(marker not in (0xDA, 0xD9), 'JPEG dimensions missing')
        length = int.from_bytes(data[offset:offset + 2], 'big')
        require(length >= 2 and offset + length <= len(data), 'Invalid JPEG segment')
        if marker in (0xC0, 0xC1, 0xC2):
            require(length >= 8, 'Invalid JPEG frame')
            return (int.from_bytes(data[offset + 5:offset + 7], 'big'),
                    int.from_bytes(data[offset + 3:offset + 5], 'big'))
        offset += length
    raise ReleaseError('JPEG dimensions missing')


def contour(value):
    require(value['database'] == 'school_events_test' and value['environment'] == 'testing'
            and value['databaseUser'] == 'school_test_user' and value['queueConnection'] == 'sync',
            'Evidence outside isolated database/role/runtime')


def verify_evidence(read, payloads):
    checks = read(EVIDENCE + 'final-checks.json')
    for key in ('typecheck', 'eslint', 'vitest', 'productionBuild', 'http'):
        require(type(checks[key]['exitCode']) is int and checks[key]['exitCode'] == 0,
                'Final check missing or failed: ' + key)
    require(type(checks['vitest']['passed']) is int and checks['vitest']['passed'] >= 469,
            'Full Vitest regression count below 469')
    http = read(EVIDENCE + 'http-pilot.json')
    require(http['completed'] is True and http['origin'] == 'http://localhost:8001'
            and http['syntheticTestOnly'] is True, 'Final HTTP E2E incomplete')
    fixture = read(EVIDENCE + 'test-fixtures.json')
    contour(fixture)
    contour(http['contour'])
    bootstrap = read(EVIDENCE + 'browser-bootstrap.json')
    require(bootstrap['completed'] is True and bootstrap['runId'] == fixture['runId'] == http['runId']
            and bootstrap['origin'] == http['origin'] and bootstrap['syntheticTestOnly'] is True,
            'Mixed or incomplete fixture/browser/HTTP run')
    require(http['requests'] and all(type(r['status']) is int and 200 <= r['status'] < 600
                                   for r in http['requests']), 'HTTP request evidence missing')
    statuses = {r['status'] for r in http['requests']}
    require({201, 403, 404, 409, 422} <= statuses, 'HTTP negative-path evidence missing')
    snapshots = {s['label']: s['actual'] for s in http['snapshots']}
    for label, count in (('N0', 0), ('N1', 1), ('N5', 5), ('N20-no-reviews', 20),
                         ('N20-reviewed5', 20), ('N20-critical-error', 20), ('N20-reviewed20', 20)):
        require(snapshots[label]['sample_size'] == count, 'Missing sample-size checkpoint')
    require(snapshots['N0']['status'] == 'no_data', 'No-data status invalid')
    require(snapshots['N1']['critical_cultural_errors_count'] is None,
            'Absent review must not become zero errors')
    partial = snapshots['N20-reviewed5']
    require(partial['audited_responses_count'] == 5 and partial['expert_review_coverage_percent'] == 25
            and partial['criteria_status']['zero_critical_cultural_errors'] == 'pending_review'
            and partial['is_expert_evaluation_completed'] is False
            and partial['is_pilot_completed'] is False, 'Partial review falsely completed')
    require(snapshots['N20-no-reviews']['is_pilot_completed'] is False
            and snapshots['N20-critical-error']['criteria_status']['zero_critical_cultural_errors'] == 'fail',
            'Missing incomplete/error KPI checkpoint')
    completed = snapshots['N20-reviewed20']
    require(completed['is_pilot_completed'] is True and completed['audited_responses_count'] == 20
            and completed['expert_review_coverage_percent'] == 100
            and completed['is_expert_evaluation_completed'] is True,
            'Completed synthetic sample lacks full audit')
    calculated = read(EVIDENCE + 'kpi-expected-vs-actual.json')
    rows = calculated['kpi']
    require(len(rows) == 6 and {r['field'] for r in rows} == set(KPI), 'Six KPI rows required')
    table = payloads[EVIDENCE + 'kpi-table.md'].decode('utf-8-sig')
    table_rows = {}
    for line in table.splitlines():
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        if cells[0] in KPI:
            require(cells[0] not in table_rows and len(cells) == 4, 'Duplicate/malformed KPI table row')
            table_rows[cells[0]] = cells
    require(set(table_rows) == set(KPI), 'KPI Markdown table incomplete')
    for row in rows:
        field, expected = row['field'], KPI[row['field']]
        require(number(row['actual']) and number(row['expected']) and row['equal'] is True
                and row['expected'] == row['actual'] == completed[field] == expected,
                'Independent KPI differs from actual HTTP result')
        cells = table_rows[field]
        require(float(cells[1]) == float(cells[2]) == expected and cells[3] in {'YES', 'PASS'},
                'KPI table differs from calculation/HTTP')
    require(read(EVIDENCE + 'aggregation-export.json')['metrics'] == completed,
            'Aggregate export differs from metrics')
    separation = http['syntheticSeparation']
    require(separation['beforeSynthetic'] == separation['afterSynthetic']
            and separation['afterSynthetic']['sample_size'] == 1
            and separation['including']['sample_size'] == 2
            and snapshots['A-real-default']['sample_size'] == 0, 'Synthetic filtering not proven')
    require(not set(http['reviewReadContract']) &
            {'reviews', 'latestReview', 'effective_finding', 'critical_cultural_errors', 'expert_audit_status'},
            'Review GET contract changed; re-review required')
    verify_database(read(EVIDENCE + 'postgresql-state.json'), fixture, bootstrap)
    runtime = read(EVIDENCE + 'restored-runtime.json')
    require(runtime['queueConnection'] == 'sync'
            and runtime['frontendApiOrigin'] == 'http://localhost:8000', 'Runtime restoration pending')


def verify_database(db, fixture, bootstrap):
    contour(db)
    schools = {s['id'] for s in fixture['schools'].values()}
    require(len(schools) == 8 and {s['id'] for s in db['schools']} == schools,
            'PostgreSQL school scope differs from fixture')
    participants = {p['id']: p for p in db['participants']}
    responses = {r['id']: r for r in db['responses']}
    require(len(participants) == len(db['participants']) and len(responses) == len(db['responses']),
            'Duplicate persistence identities')
    require(all(p['school_id'] in schools for p in participants.values())
            and all(r['participant_id'] in participants for r in responses.values()),
            'Foreign PostgreSQL row')
    require(all(r['is_synthetic'] == participants[r['participant_id']]['is_synthetic']
                and participants[r['participant_id']]['is_submitted'] is True
                for r in responses.values()), 'Response origin/submission persistence mismatch')
    findings = defaultdict(list)
    require(len({f['id'] for f in db['findings']}) == len(db['findings']), 'Duplicate finding identities')
    for finding in db['findings']:
        require(finding['pilot_response_id'] in responses, 'Foreign review finding')
        findings[finding['pilot_response_id']].append(finding)
    for versions in findings.values():
        versions.sort(key=lambda f: f['finding_version'])
        require([f['finding_version'] for f in versions] == list(range(1, len(versions) + 1))
                and all(f['is_effective'] is False for f in versions[:-1])
                and versions[-1]['is_effective'] is True,
                'Append-only sequential review versions/effective finding invalid')
    main = bootstrap['responseIds']['A']
    require(len(main) == 20 and len(set(main)) == 20, 'Completed response set incomplete')
    for rid in main:
        response = responses[rid]
        effective = findings[rid][-1]
        require(response['is_synthetic'] is True
                and participants[response['participant_id']]['school_id'] == fixture['schools']['A']['id']
                and effective['expert_audit_status'] == 'audited'
                and effective['critical_cultural_errors'] == 0, 'Completed PostgreSQL audits invalid')
    history = findings[main[0]]
    require(len(history) == 3 and [f['critical_cultural_errors'] for f in history] == [0, 1, 0],
            'Historical critical-error review versions not retained')
    partial = bootstrap['responseIds']['Partial']
    require(len(partial) == 20 and sum(bool(findings[rid]) and
            findings[rid][-1]['expert_audit_status'] == 'audited' for rid in partial) == 5,
            'PostgreSQL partial coverage must remain 5/20')
    comparisons = {c['id']: c for c in db['comparisons']}
    require(len(comparisons) == len(db['comparisons'])
            and all(c['school_id'] in schools and c['is_synthetic'] is True
                    and c['variant_a_scenario_id'] and c['variant_a_revision_id']
                    for c in comparisons.values()), 'Persisted comparison/revision identities missing')
    selected = comparisons[bootstrap['comparisonIds']['personalized']]
    require(selected['selected_variant'] == 'B'
            and selected['variant_b_scenario_id'] and selected['variant_b_revision_id']
            and selected['variant_a_scenario_id'] != selected['variant_b_scenario_id']
            and selected['variant_a_revision_id'] != selected['variant_b_revision_id'],
            'A/B selection or distinct persisted scenarios/revisions missing')


def verify_screenshots(read, payloads):
    metrics = read(SCREENSHOTS + 'metadata.json')
    used_files = set()
    for state in sorted(STATES):
        for width in (1440, 768, 390, 360):
            found = [m for m in metrics if m['state'] == state and m['requested'] == width]
            require(len(found) == 1, f'Missing/duplicate screenshot: {state} {width}')
            item = found[0]
            require(item['source'] == 'real-api-app-test' and item['syntheticLabel'] is True
                    and item['secretVisible'] is False, 'Screenshot provenance/secret/label invalid')
            require(number(item['width']) and abs(item['width'] - width) <= 1
                    and number(item['scroll']) and item['scroll'] <= item['width'],
                    'Screenshot viewport or horizontal overflow invalid')
            require(item['fullPage'] is True, 'Full-page screenshot required')
            height = item['documentHeight']
            require(number(height) and height > 0, 'Screenshot height metadata missing')
            filename = SCREENSHOTS + item['file']
            safe_path(filename)
            require(filename not in used_files and PurePosixPath(filename).suffix.lower() in {'.jpg', '.jpeg'},
                    'Screenshot reused or not JPEG')
            used_files.add(filename)
            iw, ih = jpeg_size(payloads[filename])
            require(iw > 0 and ih > 0 and abs((iw / ih) / (item['width'] / height) - 1) < 0.05,
                    'Stale screenshot frame/aspect ratio: ' + state + ' ' + str(width))
            if item.get('dialogWidth') is not None:
                require(item['dialogScroll'] <= item['dialogWidth'], 'Dialog horizontal overflow')
            require(isinstance(item['icons'], list), 'Visible asset metadata required')
            for icon in item['icons']:
                icon_size = 19 if width in (390, 360) else 20
                require(icon['loaded'] is True and icon['width'] == icon_size
                        and icon['height'] == icon_size,
                        'Visible asset failed to load or has incorrect dimensions')
                src = icon['src']
                require(src.startswith('/') and not src.startswith('//') and
                        'public' + src in payloads and payloads['public' + src],
                        'Visible asset missing from archive')
    for screen in read('docs/fe010/figma/asset-manifest.json'):
        for path in (screen['context'], screen['screenshot']):
            require(path in payloads and payloads[path], 'Figma reference missing')
        for asset in screen['assets']:
            require(asset['path'] in payloads and payloads[asset['path']], 'Figma asset missing')


def verify(archive, backend):
    require(archive.is_file(), 'FE010 archive not yet available')
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
    manifest_name = 'docs/fe010-release-manifest.json'
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
        require(not any(value in data for value in secrets)
                and re.search(rb'pilot_[A-Za-z0-9]{36}', data) is None,
                'Secret detected in archive payload')
        require(re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----', data) is None,
                'Private key content detected')
    for name in ROOT_FILES | {
        'docs/FE-010-review.md', 'docs/fe010/pilot-contract.md', 'docs/fe010/comparisons-contract.md',
        'docs/fe010/Figma-inventory.md', 'docs/fe010/independent-code-review.md',
        'tests/pilot-isolated.live.ts', 'tests/fe010-pilot.test.ts',
        'tests/fe010-comparisons.test.ts', 'tests/fe010-workflows.test.ts',
        'scripts/verify-fe010-release.py',
    }:
        require(name in payloads and payloads[name], 'Required release input missing')
    verify_evidence(read, payloads)
    verify_screenshots(read, payloads)
    return {'archive': archive.name, 'sha256': digest, 'entries': len(names),
            'bytes': archive.stat().st_size, 'fixtureRunsScanned': runs,
            'CRC': 'PASS', 'manifest': 'PASS', 'knownSecretScan': 'PASS',
            'excludedPaths': 'PASS', 'evidence': 'PASS', 'screenshots': 'PASS'}


def main():
    try:
        result = verify(ROOT / 'school-events-frontend-fe010.zip', ROOT.parent / 'school')
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
