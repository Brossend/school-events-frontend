"""Release report from actual receipts. Refuses incomplete final live acceptance."""
from pathlib import Path
import hashlib,json,re,shutil
root=Path(__file__).resolve().parents[1]
back=root.parent/'school'
out=root/'docs/llm001-1/final-v152'
read=lambda name:json.loads((out/name).read_text(encoding='utf-8-sig'))
live=read('live-http.json');cases=read('case-outcomes.json')
assert live['completed'] and cases['acceptance_complete'] and cases['technical_cases_completed']==5
for name in ('phpunit','pint','json-schema','typecheck','eslint','vitest','build','focused','regression-review','redelivery','live-provenance-selection'):
    assert (out/(name+'.exit')).read_text(encoding='utf-8-sig').strip()=='0',name
log=(out/'phpunit.log').read_text(encoding='utf-8-sig')
tests,assertions=re.search(r'Tests:\s+(\d+) passed \((\d+) assertions\)',log).groups()
requests=[json.loads(line) for line in (out/'gateway-requests.jsonl').read_text().splitlines()]
responses=[json.loads(line) for line in (out/'gateway-http.jsonl').read_text().splitlines()]
display=lambda value:'null' if value is None else str(value)
rows='\n'.join(f"| {c['case']} | {c['status']} | {display(c['prompt_tokens'])} / {display(c['completion_tokens'])} | {c['latency_ms']/1000:.1f} |" for c in cases['cases'])
core=json.loads((root/'docs/llm001-1/core-contract-hashes.json').read_text())
for row in core:
    row['unchanged']=hashlib.sha256((back/row['path']).read_bytes()).hexdigest()==row['sha256']
assert all(row['unchanged'] for row in core)
(out/'core-contract-hashes.json').write_text(json.dumps(core,indent=2),encoding='utf-8')
report=f'''# LLM-001.1 — Final technical review

**PENDING INDEPENDENT REVIEW. Технические live-случаи: 5/5. Независимая педагогическая экспертиза и Teacher Sign-Off не выполнены. Production LLM не включён.**

1 ноября 2026, Asia/Yekaterinburg. Дата отчёта; исходные UTC timestamps сохранены. Все пять выбранных новых случаев используют GigaChat-2-Max, school-methodist-1.5.2 и повторно оценены текущим Quality Gate2.3.6. Реальные результаты, а не mock, сохранены в `llm001-1/final-v152/`. Данные синтетические; localhost:8001 → school_events_test / school_test_user, run `{live['runId']}`, отдельные Redis queue/prefix. Рабочая БД и Figma не изменялись.

## Фактические результаты

| Случай | Технический статус | Prompt / completion tokens | Latency, сек |
|---|---|---:|---:|
{rows}

IDs, сравнения и отдельные quality review: `case-outcomes.json` и `quality-reviews/`. Raw и audit до отзыва evidence: `generated-samples-before-revoke.json`, `postgres-live-before-revoke.json`. После отзыва: `generated-samples.json`, `postgres-live.json`. Независимых экспертных одобрений:0; человеческих Teacher Sign-Off:0.

В окончательном isolated run наблюдалось {len(requests)} отправленных запросов и {len(responses)} полученных HTTP-ответов шлюза. `gateway-requests.jsonl` записывает начало запросов без ключа, cookies и тела; `gateway-http.jsonl` — фактические usage и finish_reason. Неизвестный usage остаётся null. При HTTP-отказе без usage либо отправке без полученного ответа полная сумма случая — null; известные значения сохранены отдельно в known_recorded_* и неизменённых GenerationRun. Странные значения metering шлюза (например prompt_tokens=1 при cached_tokens=8551) не исправляются догадками. Ценовая стоимость не вычислялась.

## Исправления и границы

Промпт и schema-derived каркас задают пять раздельных информационных карточек, два сравниваемых плана с правильной арифметикой, восемь школьных этапов/пять раундов, шесть семейных этапов/три практические части и действующую добровольную взрослую роль. Оригинальные schema, ScenarioSemanticValidator, ServerNormalizationService и Provenance Gate не изменены; побайтовые SHA-256 — `core-contract-hashes.json`.

Quality Gate дополнительно блокирует пустые материалы, абстрактные speaker_notes, раскрывающие все условия вводные слайды, отсутствие закрытого порядка выдачи ответов/handout, неполную семейную мастерскую и недостающие школьные раунды. Проверенные старые ошибки120 рублей и135/120 минут сохранены в регрессиях. Это ограниченные правила, не универсальный математический решатель или методическая экспертиза.

Repair не переписывает полный документ. Производная PATCH schema ограничивает разрешённые разделы; вложенные объекты объединяются, массивы заменяются атомарно. Для пользовательских и календарных requests производная PATCH schema адресует повреждённые слайды объектом slide_N: существующим слайдам меняются только speaker_notes, отсутствующий/невалидный слайд полностью создаёт модель. Merge возвращает исходный массив со всеми остальными слайдами. Материалы ограничены обязательными повреждёнными дочерними разделами; нетронутые корректные поля сохраняются. Каркас и полная исходная schema не дублируются в repair-промпте. Каждый итог снова проходит исходную schema/semantic/request/material проверки и Quality Gate. Допускается явно настроенный второй repair в том же общем бюджете360с; default остаётся1. Верхний предел2 проверен тестами. Последний test runtime: HTTP240с, общий бюджет360с; job420, comparison/worker840, Redis lease1200с; stale-running recovery480с. Ранние профили120/240 и180/240 сохранены в receipts. Никакого автоматического повтора после неоднозначного network/timeout и никакого mock fallback.

Gate2.3.6 также блокирует обнаруженное в свежем семейном ответе противоречие: распределение6+5+4 не может оставлять2 листа из18. Это узкая регрессия двух наблюдавшихся форм записи, остальные словесные вычисления требуют ручной оценки. Исходный ошибочный ответ и его первичная техническая оценка сохранены; новый результат выбирается только после повторной проверки.

Dev bootstrap по исходной инструкции репозитория добавил laravel/boost^2.10 и его зависимости в composer require-dev; production LLM это не включает. Composer сообщил об advisory: отдельное исследование зависимости в эту содержательную приёмку не входило.

## Культурное покрытие и негативные проверки

Каждый строковый лист, включая speaker_notes, handout, claimed_meaning и ответы, сканируется. Только точное утверждение из живого CulturalClaim с доступным evidence получает поддержку. Подтверждение даты4 ноября не распространяется на1612 год, Минина, Пожарского, соседние предложения или весь документ. Whole-document verified=false и requires_review сохраняются всегда; полнота извлечения фактов не доказана.

Для культурного B использован реальный нормативный источник201-ФЗ и только предоставленная дата; подтверждение в синтетическом контуре проверяет программную привязку, не заменяет экспертную оценку. Live revoke убирает поддержку, отключает B и даёт409 при выборе B. Выбор A выполнен только как синтетическая проверка неизменяемости; последующая замена запрещена409. Logout204 и последующий auth/me401 проверены. Повторная доставка терминальных jobs не добавила HTTP-запросов, scenarios, revisions, runs или comparisons; receipts `redelivery-before/after.json`. Teacher Sign-Off не имитировался.

## Регрессия и UI

PHPUnit: {tests} PASS, {assertions} assertions. Vitest:612 PASS; typecheck, ESLint, production build, scoped Pint, JSON Schema и OpenAPI route contract PASS. Полные логи и exit receipts приложены. Nuxt: локальное наблюдение generation-poller увеличено до600с; регрессия проверяет завершение после пяти минут. Это срок GET-наблюдения, не повтор POST и не увеличение серверного бюджета. Визуальный интерфейс не переписан.

Проверена HTTP-доступность production-сборки Nuxt; live HTTP E2E отдельно проверяет вход, tenant scope и реальные результаты GigaChat с requires_review. Визуальная экспертная оценка интерфейса не выполнялась. Runtime после проверки возвращён mock/sync, frontend API8000; `runtime-restored.json`, `production-smoke.json`.

## Предыдущие отказы не скрыты

Архивный1.3.1 имел3/5 технических случаев и содержательные дефекты. Новые discovery140/141/142/150 сохранены в одноимённых каталогах: потери полей при полном repair, новые короткие/пустые handouts, утечка ответа через слайды/пример, абстрактная речь и HTTP timeout. Они не подставлены вместо новых результатов. Отказы1.5.1 сохранены в final-v151. Все попытки окончательного прогона1.5.2, включая repair, сохранены в raw/audit и журналах шлюза. Старые raw outputs, версии и метаданные не изменены. Новая оценка старых ревизий может блокировать их использование текущим Quality Gate.

## Ограничения и передача

Технический PASS не означает готовность к реальному школьному проведению. В первичных результатах обнаружены и явно отмечены неоднозначный порядок вводных слайдов, отсутствие числа зон на лицевой карточке, неполная школьная раздатка и неточный печатный тираж. Технический gate не доказывает отсутствие таких дефектов. Педагог проверяет возрастную сложность, реальные60/90 минут, вместимость, число взрослых, безопасность маршрута, печатный тираж, доступность и порядок выдачи материалов. Проверен один контролируемый набор параметров взаимопомощи для5–6 классов; другие комбинации и направления не объявлены принятыми. Подробные замечания по каждому случаю находятся в quality-reviews, включая необходимость ручной доработки.

Культурный B контрольного примера после обязательного отзыва намеренно недоступен. Для нового культурного использования нужен актуальный source/evidence и новая проверка. estimated_wait_seconds в API остаётся статическим15 и не является прогнозом реального завершения; UI не выдаёт его за фактический прогресс. Архивы распаковать в соседние каталоги school и schoolFrontend для относительных compose/harness путей. Блокер production-включения: независимая приёмка ещё не выполнена. Human Teacher Sign-Off остаётся отдельным действием учителя.

Поставка содержит исходники, lock-файлы, тесты/регрессионные образцы, UI-kit, API/Figma документы и evidence. Исключены реальные env, ключи, config cache, vendor/node_modules, .git/.nuxt/.output. SHA-256 архивов — во внешних zip.sha256; manifests/CRC/secret scan и отдельный read-only verifier проверяют фактические байты ZIP. Полный source manifest и списки изменённых файлов приложены. Списки backend/frontend-changed-files сравнивают код, конфигурацию и тесты с исходной baseline; документы и evidence покрыты полным ZIP manifest. Подробный протокол: `quality-gate-llm001-1.md`, `cultural-claim-coverage-llm001-1.md`, backend `queues-llm001.md`.
'''
(root/'docs/LLM-001.1-review.md').write_text(report,encoding='utf-8')
readme=root/'README.md'
readme.write_text(readme.read_text(encoding='utf-8').replace('PENDING INDEPENDENT REVIEW; live acceptance incomplete','PENDING INDEPENDENT REVIEW; technical live acceptance 5/5'),encoding='utf-8')
for label,workspace,folders in [('backend',back,('app','config','database','resources','routes','scripts','tests','docker')),('frontend',root,('app','public','scripts','tests'))]:
    baseline=json.loads((root/'docs/llm001-1'/f'{label}-baseline.json').read_text(encoding='utf-8-sig'))
    candidates={p.relative_to(workspace).as_posix():p for folder in folders for p in (workspace/folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts}
    for name in ('README.md','package.json','package-lock.json','composer.json','composer.lock','docker-compose.yml','phpunit.xml','nuxt.config.ts','.env.example','.env.testing.example'):
        if (workspace/name).is_file():candidates[name]=workspace/name
    changes=[]
    for name,path in sorted(candidates.items()):
        digest=hashlib.sha256(path.read_bytes()).hexdigest()
        if baseline.get(name)!=digest:changes.append({'path':name,'before':baseline.get(name),'after':digest})
    (root/'docs/llm001-1'/f'{label}-changed-files.json').write_text(json.dumps(changes,ensure_ascii=False,indent=2),encoding='utf-8')
for name in ('LLM-001.1-review.md','quality-gate-llm001-1.md','cultural-claim-coverage-llm001-1.md'):
    shutil.copy2(root/'docs'/name,back/'docs'/name)
shutil.copytree(root/'docs/llm001-1',back/'docs/llm001-1',dirs_exist_ok=True)
print(json.dumps({'technical_cases':5,'phpunit':int(tests),'assertions':int(assertions),'gatewayRequests':len(requests),'gatewayResponses':len(responses),'status':'PENDING INDEPENDENT REVIEW'}))
