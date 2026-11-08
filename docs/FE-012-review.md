# FE-012 — итоговая интеграционная проверка

Дата: 30.10.2026. Статус: **PENDING INDEPENDENT FINAL ACCEPTANCE**.

Frontend FE-001–FE-011 сохранён; выполнены минимальные исправления интеграции. Backend: ветка `fe012-final-integration`, исходная рабочая директория уже содержала незакоммиченные изменения. Они сохранены. Frontend не имеет `.git`. Локальные точки возврата — `docs/fe012/baseline/*-before.zip`, SHA-256 manifests и receipt; резервные ZIP в поставку не входят, manifests и receipt включены. Рабочая база не мигрировалась и не заполнялась тестовыми анкетами.

## Исправленные дефекты

1. A/B читает `effective_status`, повторно проверяет действующие evidence и привязку claim → source. Сохранённый snapshot не позволяет обойти отзыв. Вариант B после отзыва недоступен, выбор возвращает 409; историческое описание пары подписано отдельно от текущего допуска.
2. Добавлено чтение текущей экспертизы и её версий: `GET /pilot/responses/{id}/reviews`. Список участников возвращает `response_id`. Учтены роли школы, системного администратора и регионального куратора; педагог и чужой регион получают отказ. Reload и переход из списка загружают эффективную версию 2 с сервера.
3. `comparison_id` проверяется внутри транзакции приглашения: школа, сценарий, завершённость и допустимость B. Неверная ссылка не расходует приглашение. Два одновременных ответа дают 201 и 409.
4. Calendar API возвращает реальные fixed dates и occurrences. Nuxt распределяет события по дням, показывает диапазоны; покрыты многодневность, границы года, високосная дата и приоритет конкретного occurrence. Даты из названий не выводятся.
5. MockLlmProvider ссылается на точное название созданной активности family_community. Для универсального A/B устранён старый формат ответа mock. Строгие валидаторы сохранены; production LLM не подключался.
6. Первопричина отсутствующего amendment audit: синхронный observer `SourceReview::saved` сбрасывал evidence до выборки контроллером. Теперь проверенные строки захватываются под блокировкой до observer, в той же транзакции. Регрессия до патча действительно падала. Два verified claims после PATCH теряют подтверждение и получают по одному audit; повторная проверка требуется явно. OPcache не был необходим для воспроизведения.
7. Очередь каталога сортируется `created_at DESC, id DESC`. Три HTTP-страницы с одинаковыми timestamps не дали повторов; семь новых собственных fixture-записей имеют точный ожидаемый порядок.
8. Изменение источника и attach/detach используют согласованный source-first lock. Конкурентный одинаковый PATCH не создаёт двойной audit; конкурентный detach даёт 200/404 и один audit.
9. В тестовом Redis-контуре export выполняется настоящим worker, а не testing sync shortcut. Production sync-поведение не менялось.
10. Финальный secret scan выявил совпадения реальных локальных demo-паролей с fallback-константами старых исходников. Для безопасной поставки убраны шесть fallback из seeder (теперь env либо случайный пароль), старые HTTP-аудиты требуют env без литеральных defaults, исторический archive verifier читает локальные secrets без встраивания/печати, один auth-тест использует собственный test-only пароль. Это дополнительные изменения гигиены поставки, не миграция и не смена существующих паролей. Seeder не запускался. Изменённые Python-скрипты скомпилированы; весь PHPUnit повторно запущен после правки.

Точный список 28 серверных файлов и актуальные SHA-256: `fe012/backend-changed-files.json`, `fe012/backend-file-hashes.json`. 19 файлов относятся к интеграции и её проверкам; ещё 9 — к устранению встроенных demo-credentials в поставке. Новых миграций нет.

## Результаты проверок

| Проверка | Результат | Evidence |
|---|---|---|
| Typecheck | PASS | `fe012/typecheck.log`, `.exit` |
| ESLint | PASS, без предупреждений | `fe012/eslint.log`, `.exit` |
| Vitest | 601 PASS, 20 файлов (предыдущая база 588) | `fe012/vitest.log` |
| Production build и smoke | PASS; 5 SPA routes, 11 assets, обычный API origin 8000 | `fe012/build.log`, `fe012/production-smoke.json` |
| PHPUnit целиком | 292 PASS, 1485 assertions | `fe012/phpunit.log` |
| Scoped Pint | PASS | `fe012/pint.log` |
| JSON Schema | PASS | `fe012/json-schema.log` |
| OpenAPI route contract | 59 операций; 3 теста PASS | `fe012/route-contract.log` |
| Записанные JSON-ответы vs OpenAPI | 90 ответов, 0 нарушений | `fe012/response-contract.json` |
| Migrations fresh / upgrade | PASS; 19 migrations, sentinel сохранён | `fe012/migrations.json` |
| Основной live HTTP E2E | PASS, 144 ответа, 310.52 s | `fe012/http-e2e.log`, `fe012/evidence/http-full-stack.json` |
| Ошибки / транспорт / конкуренция | PASS | `fe012/faults-e2e.log`, `fe012/evidence/faults.json` |
| Документы | PDF 4 стр.; print pack 3 стр.; DOCX CRC/text; PPTX 5 slides + notes | `fe012/evidence/document-validation.json` |

Весь integration run `bb46ed8810` выполнен через localhost:8001, `APP_ENV=testing`, PostgreSQL `school_events_test`, роль `school_test_user`. Redis использовал отдельные очередь и prefix. Migrations проверены в двух временных схемах этой базы, схемы удалены, public ledger остался 19. Ранее диагностический run `4e94f87949` остановился на неверном ожидании теста PATCH 200: действительный корректный ответ — 201. Он сохранён отдельно в `evidence/discovery`, не объявлен PASS.

## Матрица пользовательских потоков

| № | Поток | Реальное подтверждение |
|---|---|---|
| 1 | Вход / выбор школы / выход | CSRF cookie, login, me, memberships, явный выбор школы, X-School-Id, logout, 401 и browser redirect |
| 2 | Dashboard / calendar | summary и даты из API; grid/list, реальные occurrences |
| 3 | Events / sources / claims | read API, review, amendment, evidence attach/detach и live provenance |
| 4 | Traditions | создание и годовая версия, чтение и конфликт |
| 5 | Constructor | сохранённый запрос с настоящим snapshot, ошибки валидации |
| 6 | Generation / results | Redis jobs для class_level, all_school, family_community |
| 7 | Editor / revisions | новая версия 2, устаревший lock даёт 409 |
| 8 | Moderation | фактическая серверная проверка и состояние revision |
| 9 | Teacher sign-off | подтверждение и защита signed revision |
| 10 | PDF / DOCX / PPTX / print pack | четыре job: queued → processing → ready, реальные скачанные файлы |
| 11 | My events / archive | archive, restore, допустимый soft-delete; signed delete conflict |
| 12 | A/B | универсальная пара, культурная пара, отзыв B и 409 выбора |
| 13 | Pilot / KPI | token concurrency, неверные comparison, expert v1/v2, GET history, реальные агрегаты synthetic N=1 |
| 14 | School profile | RBAC, настройки, чужая школа 403, разрешённое обновление собственной |
| 15 | System / catalog | system summary, regional scope, стабильная очередь, source/evidence review |

Основной HTTP trace и PostgreSQL snapshots до/после являются первичными свидетельствами. Скриншоты — дополнительные свидетельства отрисовки, не замена HTTP-тестов. Пути и отметки фаз сохранены в trace.

## Отрицательные сценарии и инструментация

401/403/404/409/422 проверены настоящими endpoints. После отзыва primary source evidence старые четыре download и новый export возвращают 403. Второй claim остаётся проверенным: история не уничтожается и отзыв не подменяется глобальным удалением.

500 воспроизведён временным trigger на собственный тестовый source: PATCH завершился 500 и изменение откатилось. SQL применён существующим DBA только к school_events_test, права роли не расширялись. Trigger/function удалены в finally. Сетевой reset проверен контролируемым локальным сокетом. Потерянный ответ после принятого archive дал ApiError 0; автоматического повторного POST нет, GET сверил принятое состояние, затем выполнен явный restore. Поздний ответ прежнего контекста школы отброшен.

419 проверен настоящим Laravel CSRF middleware в `AuthTest::test_missing_csrf`, где отключён штатный testing bypass. Live HTTP419 в APP_ENV=testing **не заявляется**: Laravel в этом режиме пропускает CSRF middleware. Отдельный fault-прогон содержит 19 HTTP-ответов. Итоговый `restored-runtime.json` подтверждает sync и отсутствие временных trigger/schema; worker завершён, браузерная сессия закрыта, обычный frontend возвращён к API8000.

В guarded test worker на committed `processing` добавлено окно наблюдения 2.5 секунды. Статусы не подменялись; выполнялись настоящие renderers. HTTP polling наблюдал все три состояния каждого из четырёх форматов; DB transitions сохранены в `export-transitions.jsonl`. PDF страницы визуально просмотрены после рендера.

## OpenAPI и DTO

OpenAPI 1.5.0 синхронизирован с Laravel: `/auth/me` возвращает envelope `data.user` с membership-данными (как login), а не прежнее ошибочное ожидание прямого user. Добавлены calendar dates, settings, source PATCH, evidence attach/detach, pilot response/history, metrics, scenario filters, export jobs. Дополнительная проверка реальных ответов исправила nullable в формате JSON Schema 3.1, вложенное evidence без parent claim ID, сокращённый create request и mutation envelope редактора, массив cultural_provenance_data.

`scripts/fe012-sync-openapi.mjs`, `npm run api:generate`, `scripts/validate-fe012-contract.py` воспроизводят синхронизацию и проверку. 90 сохранённых JSON-ответов соответствуют контракту. Auth payload/cookies и одноразовый invite_token удалены из evidence; binary/status без JSON schema пропущены явно. Generic object-поля пока не проверяют вложенные значения исчерпывающе. Runtime frontend parsers и локальные overrides сохранены там, где generic контракт ещё недостаточен; автоматическое удаление overrides не выполнялось.

## Визуальная проверка и Figma

Повторно прочитан оригинальный calendar Figma node `1:2146` файла `yM3uywBNWGprDE61hxKK3V`; контекст сохранён в `fe012/figma-calendar-context.txt`. Использованы принятые FE-002–FE-011 компоненты, локальные Figma SVG и ранее сохранённые контексты. Figma не изменялась, масштабного редизайна нет.

Снимки реального test API и измерения: `fe012/screenshots/metadata.json`; итоговая визуальная сверка — `fe012/browser-verification.json`. 68 снимков 17 состояний на 1440/768/390/360 px: горизонтальных переполнений нет, видимые SVG загружены. Дополнительно сохранён logout redirect. Общий contact sheet и полный мобильный календарь просмотрены. История экспертизы после reload и запрет культурного B сверены с сервером. Синтетические результаты не выдаются за завершённое исследование.

## Ограничения и зависимости

- Row locks сериализуют операции и исключают подтверждённые дубли audit; **ETag/version precondition источников пока нет**. Два разных изменения одного поля по-прежнему имеют last-writer semantics. Минимальное следующее расширение: `lock_version`/ETag, обязательный `If-Match` на PATCH/review/detach, проверка версии внутри того же source-first lock, 409/412 на устаревшую версию и тесты двух кураторов. Frontend GET-preflight не является атомарной гарантией.
- Реальная эффективность LLM, работа production provider, настоящее исследование на 20 педагогах и deployment не входят в доказанные результаты. Использованы synthetic fixture и MockLlmProvider.
- Dependency audit не зелёный: 8 advisories (1 high node-forge, 7 low включая транзитивные meta warnings). Цепочка Nuxt → Nitro → listhen → node-forge принадлежит инструментам запуска/dev TLS; deepmerge → rollup resolver — сборка. Наличие в npm dependencies само по себе не означает наличие в собранном runtime. Проверка фактического `.output/server` не нашла эти четыре пакета или их импорты; единственное текстовое упоминание Nitro — комментарий renderer. Это зафиксировано в `production-smoke.json`. При поставке исходников dev/build risk остаётся. `npm audit fix --force` и откат Nuxt не выполнялись. Полный audit и дерево приложены.
- Docker/PostgreSQL/Redis, PHP extensions, Composer dependencies и доступные renderers нужны для запуска backend. `.env`, ключи и сессии в ZIP отсутствуют, конфигурацию нужно создать локально.

## Поставка и возврат

Архивы `school-events-final-fe012.zip` и `school-backend-integration-fe012.zip` содержат source, lockfiles, тесты, UI-kit, API/Figma docs, отчёт и evidence. Backend архив — полный воспроизводимый source текущего backend, включая принятые ранее изменения; точный delta FE012 перечислен отдельно. vendor/node_modules/build caches, реальные .env, ключи, cookies, invite tokens, резервные и старые ZIP исключены. Пустые storage/bootstrap cache директории восстановлены только через .gitignore. CRC, manifests и secret scan проверяются `scripts/package-fe012.py`.

SHA-256 находятся в соседних `.zip.sha256` и внешнем `fe012/release-verification.json`: собственный hash архива намеренно не встроен в его содержимое. Инструкция запуска — `FE-012-launch.md`. Для возврата к исходникам до FE012 используйте локальные baseline ZIP и hash manifests; восстановление выполняйте в отдельную директорию, сравнив с текущей, поскольку исходный backend уже был dirty. Миграционный rollback для FE012 не требуется.
