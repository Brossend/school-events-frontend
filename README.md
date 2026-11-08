> **LLM-001.1: PENDING INDEPENDENT REVIEW; live acceptance incomplete.** Дополнительные предупреждения качества не равны экспертной приёмке. См. [итоговый отчёт](docs/LLM-001.1-review.md) и [протокол культурного покрытия](docs/cultural-claim-coverage-llm001-1.md).

# Школьные события — frontend

Основной репозиторий и CI/CD: [GitLab frontend](https://gitlab.com/Brossend2335/school-events-frontend). [Backend на GitLab](https://gitlab.com/Brossend2335/school-events-backend). GitHub — зеркало той же ветки `main`, самостоятельное развёртывание через GitHub Actions не используется. Pipeline находится в `.gitlab-ci.yml`; необходимые переменные и дальнейший DEPLOY-001 описаны в [REPO-001](docs/REPO-001-report.md). Последняя браузерная проверка: [DEMO-001](docs/DEMO-001-browser-check.md).

Отдельное Nuxt 4 SPA-приложение «Сбер × УрФУ». Текущая поставка включает FE-001–FE-011 и итоговую интеграцию FE-012: календарь, сценарии, версии, модерацию, экспорт, A/B, пилот, профиль школы и культурный каталог.

**FE-012: PENDING INDEPENDENT FINAL ACCEPTANCE.** Результаты, ограничения и evidence: [итоговый отчёт](docs/FE-012-review.md). Полный запуск платформы и изолированных проверок: [инструкция](docs/FE-012-launch.md). Ниже сохранены пояснения предыдущих этапов.

## Запуск

Нужен Node.js **24.15+** (проверено на 24.22.1; версия закреплена в `.nvmrc`). Системный Node 24.12 не соответствует требованиям актуального Nuxt.

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Приложение: http://localhost:3000. API по умолчанию: http://localhost:8000. Для другого адреса измените `NUXT_PUBLIC_API_ORIGIN`.

Backend находится отдельно, в `../school`. Минимальные серверные изменения FE-012 перечислены в итоговом отчёте. Для реального входа сервер должен быть запущен, иметь пользователя и разрешать Origin `http://localhost:3000` в CORS и Sanctum. Используйте один hostname (`localhost`) для обоих приложений. При разных поддоменах нужны корректные общие cookie-domain и HTTPS/SameSite-настройки сервера.

## Проверки

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

Типы API уже включены в репозиторий. Для обновления из соседнего backend:

```powershell
npm run api:generate
```

Путь можно переопределить переменной процесса `BACKEND_OPENAPI`. Генератор не читает `.env` автоматически; по умолчанию используется `../school/docs/openapi.yaml`.

## Содержание этапа

- Адаптивный вход, показ пароля, обработка валидации и ошибок сети.
- Sanctum SPA session, CSRF-cookie, однократное восстановление CSRF при 419.
- Загрузка пользователя и членств, выбор/смена школы с `X-School-Id`, выход.
- Pinia, типизированный API-клиент, проверки доступа, UI-kit и layouts.
- Каркас маршрутов следующих этапов с явным указанием незавершённости.

Восстановление пароля и демовход не реализованы сервером. Интерфейс объясняет ограничение и не имитирует успешное действие. «Запомнить меня» отключено: контракт входа содержит только email/password.

## Конструктор FE-005

`/constructor` — пять связанных шагов. `/scenario-requests/:id` — реальное чтение сохранённого запроса. Доступ требует выбранной школы. Генерация и polling не запускаются. Черновик хранится только в памяти; sessionStorage содержит лишь ID/состояние операции для защиты от повторной записи. При неизвестном результате автоматического повтора нет.

## Документы

- [FE-005: конструктор, контракты, проверки и ограничения](docs/FE-005-review.md)

- [FE-004: традиции, архив, неизменяемые версии, тесты и план FE-005](docs/FE-004-review.md)

- [FE-003: реализация, роли, проверки, ограничения дизайна и план FE-004](docs/FE-003-review.md)

- [FE-002: реализация, тесты, HTTP, ограничения и план FE-003](docs/FE-002-review.md)

- [Техническая карта Figma и архитектура](docs/implementation-map.md)
- [API-интеграция и расхождения контрактов](docs/api-integration.md)
- [Отчёт о проверках и ограничения приёмки](docs/FE-001-review.md)
- [Финальная техническая проверка и передача](docs/FE-001-final-review.md)
- [Полный перечень секций и экранов Figma](docs/figma-inventory.xml)
- [Фактические переходы прототипа FE-001](docs/figma-prototype.json)

Реальная интеграционная проверка запускается отдельно от unit-тестов:

```powershell
# Передайте данные существующих тестовых аккаунтов через окружение процесса:
# LIVE_EMAIL, LIVE_PASSWORD — пользователь с несколькими школами;
# LIVE_TEACHER_PASSWORD — педагог без членства в одной из этих школ.
# LIVE_CURATOR_PASSWORD, LIVE_ADMIN_PASSWORD — существующие системные аккаунты для provenance.live.ts.
# Не записывайте пароли в исходники или отчёты.
npm run test:integration
```

По умолчанию используется API `http://localhost:8000` и frontend Origin `http://localhost:3000`. Их можно переопределить через `LIVE_API_ORIGIN` и `LIVE_WEB_ORIGIN`; адрес педагога — через `LIVE_TEACHER_EMAIL`. Проверка выполняет настоящие HTTP-запросы без mock API. Результат с обезличенным `/auth/me` и без cookie/паролей сохраняется в `docs/evidence/live-api-results.json`.

Архив FE-004 собирается и проверяется командой `python scripts/package-release.py fe004`; используются только явно разрешённые файлы. SHA-256 записывается рядом с ZIP. Этот архив не содержит production build: для развёртывания отдельно выполните build и запускайте `node .output/server/index.mjs`.

Главная использует реальную сводку школы. Календарь сохраняет API-фильтры и представление в URL. List/detail API пока не возвращают даты событий; сетка служит выбору периода/дня без выдуманных маркеров. Поиск отдельной категории/возраста и серверная сортировка в текущем OpenAPI отсутствуют. `/calendar/:id`, `/sources/:id`, `/claims/:id` показывают настоящие источники, цитаты и экспертные решения. Очередь и формы мутаций куратора не добавлены: отдельных утверждённых макетов не найдено. Подробности и предложение дат — в отчёте FE-003.

`tests/provenance.live.ts` выполняет только чтения бизнес-данных и вход/выход. Записи/отзывы evidence допускаются только в изолированном app-test, по инструкциям отчёта; запускать мутационные тесты на рабочем API нельзя. Для старого auth/calendar сценария отдельно укажите `tests/api-integration.live.ts` в команде Vitest. Provenance evidence сохраняется в `docs/fe003/evidence/provenance-http.json`.

## Структура

```text
app/
  assets/css/          # токены и адаптивные стили
  components/ui/       # базовые компоненты
  components/layout/   # брендовая панель и навигация
  components/features/ # вход, выбор школы, состояния будущих этапов
  composables/         # доступ к API
  layouts/             # auth и рабочее пространство
  middleware/          # авторизация и ограничения по ролям
  pages/               # Nuxt routing
  plugins/             # API-клиент и централизованные ошибки
  stores/              # профиль, школа, уведомления
  types/               # OpenAPI DTO и типы приложения
  utils/               # транспорт, ошибки, сессия, доступ
public/icons/          # исходные SVG из Figma
scripts/               # генерация типов
tests/                 # Vitest
docs/                  # исследование, ограничения, evidence
```

Традиции доступны через `/traditions`: метаданные, ежегодные снимки, авторские права редактирования и архив. Мутационный HTTP-test `tests/traditions-isolated.live.ts` запускается только по явному FE004_ISOLATED=1 против фиксированного app-test:8001. Инструкции подготовки отдельных fixtures и переменных процесса — в отчёте FE-004. Без флага тест пропускается, рабочая БД не используется.
# FE-006: генерация и просмотр

Сохранённый запрос FE-005 теперь запускается отдельным подтверждённым действием с Idempotency-Key. Доступны `/generation-runs/:id`, безопасный polling и `/scenarios/:id` с реальной ревизией, материалами и источниками. [Отчёт FE-006](docs/FE-006-review.md), [Figma inventory](docs/fe006/figma-node-inventory.md). Статус: PENDING INDEPENDENT REVIEW.

Проверки: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. Требуется Node согласно engines. Изолированный E2E: `FE006_ISOLATED=1 npm run test:integration -- tests/generation-isolated.live.ts`, только после подготовки guarded fixtures `tests/backend/fe006-fixtures.php` в app-test:8001 и отдельной Redis очереди через `tests/backend/fe006-compose.override.yml`. Имя очереди берётся из test-fixtures.json; worker: `php artisan queue:work redis --queue=<fixture.queue> --stop-when-empty --tries=1 --timeout=120`. Не запускать против рабочей БД. Harness редких состояний: Vite с `tests/visual/fe006.config.ts`; он явно маркирует synthetic fixture и не используется приложением.

Backend MockLlmProvider не является внешней LLM. Редактор, sign-off, экспорт и FE-007 не реализованы. Обнаруженная серверная ошибка семейной конфигурации описана в отчёте. Архив: `python scripts/package-release.py fe006`; независимая проверка состава: `python scripts/verify-fe006-release.py`.


## FE-007 — редактор и подтверждение

`/scenarios/:id/edit` открывается из режима чтения при наличии школьных полномочий. PATCH создаёт новую ревизию с If-Match из optimistic_lock_version, сохраняет черновик при 422 и показывает сравнение при 409. Повторная проверка и чек-лист педагога привязаны к ревизии; историческая запись sign-off не выдаётся за бессрочный актуальный допуск. Старый `/generation/:id` перенаправляется в `/generation-runs/:id`.

[Отчёт FE-007](docs/FE-007-review.md), [контрактные расхождения](docs/fe007/contract-notes.md), [Figma inventory](docs/fe007/figma-node-inventory.md). Статус: PENDING INDEPENDENT REVIEW. Экспорт FE-008 не реализован.

Изолированный E2E: `FE007_ISOLATED=1 npm run test:integration -- tests/editor-isolated.live.ts`, только после подготовки `tests/backend/fe007-fixtures.php` в app-test и отдельной Redis-очереди через `tests/backend/fe007-compose.override.yml`. Он намеренно изменяет только synthetic fixtures в school_events_test, не рабочую БД. Компонентный harness редких состояний: Vite с `tests/visual/fe007.config.ts`, localhost:3107; маркирован как fixture и не подключён к приложению.

Поставка: `python scripts/package-release.py fe007`, `python scripts/verify-fe007-release.py`.


## FE-008

Экспорт и история доступны в просмотре и редакторе сценария. Четыре серверных формата: PDF, DOCX, PPTX, Print Pack PDF. Документы не генерируются в браузере. Неопределённый POST восстанавливается явно с тем же Idempotency-Key; доступность скачивания берётся из свежей истории и повторно проверяется сервером.

Приёмка: [docs/FE-008-review.md](docs/FE-008-review.md), [контракт API](docs/fe008/api-contract.md), [Figma inventory](docs/fe008/figma-node-inventory.md). Скачанные синтетические документы — `docs/fe008/evidence/documents/`. Проверка их контейнеров/содержимого: `scripts/validate-fe008-documents.py` с Python, имеющим pypdf.

Изолированный HTTP E2E: подготовить fixtures через `tests/backend/fe008-fixtures.php` только в app-test и school_events_test, подключить frontend override для отдельной Redis queue, затем `FE008_ISOLATED=1 npm run test:integration -- tests/exports-isolated.live.ts`. Пароль выводится в памяти из testing APP_KEY, не хранится в отчётах. Скрипт изменяет только собственные FE008 fixtures, в том числе временно имитирует legacy fingerprints. После проверки восстановить base compose app-test (sync). В testing HTTP export синхронен; production queued/processing проверены controller-тестами и явно помеченным стендом `tests/visual/fe008.config.ts`. На момент поставки FE-008 этап FE-009 ещё не реализовывался.


## FE-009

`/events` — серверный список сценариев выбранной школы с поиском, сортировкой, пагинацией и архивом. Архивирование/восстановление/soft-delete требуют отдельного подтверждения. Неопределённый результат мутации сначала сверяется GET; автоматического повторного DELETE нет. Удалённые записи этим UI не восстанавливаются. Статусы не удостоверяют актуальность provenance/sign-off.

Отчёт: [docs/FE-009-review.md](docs/FE-009-review.md). Контракт: [docs/fe009/api-contract.md](docs/fe009/api-contract.md).

Тесты: `npm test` включает регрессию 289 прежних тестов и FE009/P2. Реальные E2E: создать fixtures скриптом `tests/backend/fe009-fixtures.php` исключительно через app-test/school_events_test; затем `FE009_ISOLATED=1 npm run test:integration -- tests/events-isolated.live.ts`. Исторический sign-off: `FE009_HISTORICAL=1 npm run test:integration -- tests/events-historical.live.ts` после основного E2E. Скрипты меняют только собственные FE009 записи; пароли выводятся из testing APP_KEY в памяти и не сохраняются в отчёте.

Поставка: `python scripts/package-release.py fe009`, затем `python scripts/verify-fe009-release.py`. На момент поставки FE-009 этап FE-010 ещё не реализовывался.


## FE-010

`/comparisons` создаёт реальные A/B-пары из сохранённого ScenarioRequest выбранной школы. Предпочтение и причина фиксируются один раз после подтверждения. История, варианты и восстановление неизвестного результата используют существующие GET Laravel; повторные POST автоматически не отправляются.

`/pilot` показывает шесть серверных KPI, размер выборки и покрытие экспертизой. Уполномоченным пользователям доступны приглашения, JSON-экспорт агрегатов и новая версия экспертного заключения. `/pilot/respond` — публичная одноразовая анкета; токены не передаются в URL и не сохраняются в браузерных хранилищах. Режим синтетических агрегатов доступен только на точном API `http://localhost:8001`; по умолчанию флаг включения отсутствует. На рабочем API интерфейс не включает синтетические данные.

Контрактные ограничения и результаты: [FE-010-review.md](docs/FE-010-review.md), [Figma inventory](docs/fe010/Figma-inventory.md), [Pilot API](docs/fe010/pilot-contract.md), [A/B API](docs/fe010/comparisons-contract.md). GET анкеты не возвращает экспертное заключение/историю; отсутствие проверки не равно нулю ошибок. Культурный B может быть недоступен из-за описанного расхождения backend, которое FE-010 не исправляет.

Проверки: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. Изолированный E2E: `FE010_ISOLATED=1 npm run test:integration -- tests/pilot-isolated.live.ts`. Скрипт сам создаёт только собственные тестовые школы/аккаунты и выполняет мутации строго через app-test:8001/school_events_test; рабочую БД не изменять. Все записи и скриншоты этого E2E синтетические, включая отдельную проверку фильтра is_synthetic=false.

Поставка: `python scripts/package-release.py fe010`, затем `python scripts/verify-fe010-release.py`. Статус FE-010 на момент его поставки: PENDING INDEPENDENT REVIEW.


## FE-011

`/school` читает реальные реквизиты, настройки и вычисляемые показатели. Администратор своей школы и системный администратор сохраняют разрешённые поля; педагог читает профиль. Системная роль без членства открывает конкретную школу по UUID. `/profile` сохраняет выбор школы и членства. `/system` отображает только предоставленные API состояние и роль.

`/catalog` содержит очередь, библиографические реквизиты, экспертные решения и историю, привязку/открепление evidence конкретного утверждения. FE003 provenance-компоненты переиспользованы. Неизвестная запись и принятая запись с неудачным GET блокируют новые действия до сверки; повторной отправки нет. Конфликт реквизитов имеет явное обновление основы с сохранением пользовательских изменений.

[Отчёт FE-011](docs/FE-011-review.md), [Figma inventory](docs/fe011/Figma-inventory.md), [независимое код-ревью](docs/fe011/independent-code-review.md), [план FE-012 — только документ](docs/fe011/FE-012-backend-plan.md).

Проверки: typecheck, ESLint, 588 Vitest-тестов, production build. Изолированный HTTP-прогон: `FE011_ISOLATED=1 npm run test:integration -- tests/admin-isolated.live.ts`, только `localhost:8001 → app-test → school_events_test`; скрипт создаёт собственные синтетические fixtures. Не переносить этот запуск на рабочий API. Авторизация выводит пароль в памяти из testing APP_KEY; секреты в архив не включаются. Обычный frontend использует API localhost:8000.

Поставка: `python scripts/package-release.py fe011`, затем `python scripts/verify-fe011-release.py`. Статус: PENDING INDEPENDENT REVIEW. FE-012 не реализован.
