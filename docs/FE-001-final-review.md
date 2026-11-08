# FE-001 — Final Integration & Independent Review Handoff

**Статус: PENDING INDEPENDENT TECHNICAL REVIEW.**

Дата: 25 октября 2026, Asia/Yekaterinburg. Frontend: `schoolFrontend`, пакет `school-events-frontend`. Backend: существующий Laravel в `../school`, API `http://localhost:8000`. Визуальная приёмка по Figma принята как входное условие этой проверки. Figma и готовые визуальные компоненты не изменялись; FE-002 не начинался.

Этот документ дополняет и актуализирует исторический `FE-001-review.md`: прежнее ограничение «backend недоступен, интеграция не проверена» снято после восстановления Docker пользователем и выполнения реальных проверок ниже.

## 1. Что изменено в поставке

- Добавлен opt-in live-тест `tests/api-integration.live.ts`, отдельный `vitest.live.config.ts` и npm script `test:integration`. Это реальные HTTP-запросы к существующему Laravel через тот же `createApiClient`, который использует приложение; mock API не добавлялся.
- Добавлены проверка production artifact `scripts/inspect-runtime.mjs` и сборщик исходного архива `scripts/package-release.py`.
- Включены свежие audit/tree/evidence, обезличенный фактический `/auth/me`, screenshots защищённых экранов и инструкция повторного запуска.
- Код API backend, OpenAPI backend, конфигурация Laravel и база предметных данных не редактировались. Миграции не запускались; выполнен только `migrate:status`, все 19 миграций уже применены. Сидеры не запускались, аккаунты и членства не создавались/не менялись. Проверки использовали существующие локальные демонстрационные аккаунты; создавались и завершались только обычные auth-сессии.

## 2. Запуск существующего backend

Первый автоматический запуск Docker Desktop завершился ошибкой служебного сокета `dockerInference`. Автоматическая проверка безопасности отклонила команду остановки Docker/удаления этого временного файла; команда не выполнялась. Пользователь затем сообщил «Запустил Докер», после чего Docker Engine действительно стал доступен.

Выполнено в `../school`:

```text
docker compose up -d app nginx postgres redis
docker compose exec -T app php -v
docker compose exec -T app php artisan migrate:status --no-ansi
```

Основные `app`, `nginx`, `postgres`, `redis` работают, Nginx/PostgreSQL/Redis healthy, PHP 8.4.27. Реальный `GET /api/v1/health` вернул 200:

```json
{
  "status": "ok",
  "services": { "database": "connected", "redis": "connected" }
}
```

Полный ответ и длительность 4.74 секунды сохранены в `evidence/backend-health.json`. Отмечен также один health timeout при лимите 8 секунд; последующий запрос с лимитом 30 секунд прошёл. Это наблюдение о локальной среде, не утверждение о performance/SLA-приёмке. Существующий неиспользуемый `nginx-test` перезапускается; основной контур 8000 от него не зависит, тестовый контур в рамках FE-001 не ремонтировался.

## 3. Реальная интеграция и отрицательные сценарии

Команда `npm run test:integration` выполнялась через bundled Node.js 24.22.1. Данные входа переданы только переменными процесса из существующей локальной конфигурации backend, без вывода значений в отчёт/исходники. Успешный итог: **1 live-тест PASS**, 13 последовательных контрольных пунктов. Тест проверяет и тело ответов, и `X-School-Id`, и CORS. Полный обезличенный журнал — `evidence/live-api-results.json`, поле `completed: true`.

| Проверка | Реально наблюдавшийся результат |
|---|---|
| Явный запрос `/sanctum/csrf-cookie` | 204, выставлены cookie XSRF/session; значения не сохранены в evidence |
| `/auth/me` до входа | 401, обработчик unauthorized вызван |
| Вход существующего пользователя с двумя школами | 200, JSON с user и двумя memberships, сессионные cookie |
| `/auth/me` после входа | 200, равен профилю login, содержит обе школы |
| Выбор каждой из двух доступных школ | 200, request `X-School-Id` соответствует выбранной школе, response data подтверждает её |
| Несуществующий school UUID | 404; это проверка отсутствующего ресурса, не отсутствие членства |
| Существующая чужая школа для отдельного педагога | 403, доступ не предоставлен |
| `/system/status` для пользователя школы | 403 |
| Неправильный пароль | 422 `INVALID_CREDENTIALS` |
| Намеренно устаревший XSRF-заголовок перед logout | Реальный 419 от Laravel → CSRF-cookie 204 → повтор logout 204 |
| `/auth/me` и `/tenant/current` после logout | Оба 401; серверная сессия больше не даёт доступа |
| Закрытый TCP-порт | Реальный отказ соединения преобразуется в ApiError status 0 |
| CORS при входе | `Access-Control-Allow-Origin: http://localhost:3000`, `Access-Control-Allow-Credentials: true` |

419 получен без отключения CSRF: на первом запросе заголовок намеренно не соответствует настоящей cookie. После реального CSRF-cookie тот же клиент повторяет запрос ровно один раз. Этот fault injection существует только в тесте, код приложения и настройки защиты не менялись.

В ходе подготовки первый live-запуск остановился из-за недоступного Docker, второй выявил неверное ожидание **403 для несуществующей школы**. Ожидание исправлено на фактический 404, а настоящий 403 проверен отдельно на существующей школе без членства. Финальный запуск полностью прошёл. Эти ранние неуспешные попытки не выданы за успешную проверку.

## 4. `/auth/me`: OpenAPI против фактического JSON

OpenAPI `paths./auth/me.get.responses.200.content.application/json.schema` ссылается на `#/components/schemas/UserEnvelope`. Он требует следующий плоский конверт:

```json
{
  "data": {
    "id": "<user-uuid>",
    "name": "<name>",
    "email": "<email>",
    "system_role": "none"
  }
}
```

**Фактически полученный по HTTP JSON** (идентифицирующие значения обезличены, структура и роли сохранены):

```json
{
  "data": {
    "user": {
      "id": "<user-uuid>",
      "name": "<redacted>",
      "email": "<redacted>",
      "system_role": "none"
    },
    "schools": [
      {
        "school_id": "<school-1-uuid>",
        "name": "<school-1>",
        "role": "teacher",
        "is_default": true
      },
      {
        "school_id": "<school-2-uuid>",
        "name": "<school-2>",
        "role": "teacher",
        "is_default": false
      }
    ]
  }
}
```

Это подтверждает `AuthController::me → formatUserResponse`: один формат используется для login и me. `api-contract.md` также обещает профиль вместе с членствами. **Корректное решение — согласовать OpenAPI с работающим сервером**, заменив response ref `/auth/me` на существующий `LoginResponse` либо введя общий `SessionProfileEnvelope` для login/me. Менять сервер на плоский ответ не следует: это потеряет членства и нарушит рабочий tenant flow.

В текущей поставке backend/OpenAPI не менялись. Frontend использует узкий runtime-адаптер `parseSessionProfile(unknown)` с проверкой user, schools и допустимых ролей; generated OpenAPI DTO сохранены без ручного изменения. После отдельного согласованного исправления backend-spec надо перегенерировать типы, типизировать me общим session-envelope и сохранить runtime-проверку как границу доверия. Нельзя просто удалить адаптер, принять плоскую схему или ослабить все типы до any. Unit-тесты проверяют отклонение старой формы и недопустимой роли.

## 5. Визуальная проверка защищённых экранов

Выполнен настоящий вход в браузере на `http://localhost:3000` под существующим multi-school пользователем. Без обхода middleware и без подстановки фиктивной сессии проверены:

- Workspace после login: имя из реальной сессии, общая навигация, честное обозначение будущего дашборда FE-002.
- Профиль: данные пользователя и оба членства. Смена Лицея №130 на Гимназию №9 подтверждается серверным результатом и строкой «Выбрана». Обновление профиля сохраняет выбранную доступную школу в текущем SPA-сеансе.
- Desktop 1440 и mobile 360: профиль, select, действия и footer читаемы; при 360 `scrollWidth === innerWidth === 360`, переполнения нет. Длинное название внутри нативного select обрезается браузером, полное подтверждённое название ниже переносится на строки.
- Прямое открытие `/system` под педагогом приводит к `/forbidden`, отображается «Недостаточно прав».
- Logout через диалог действительно возвращает login. После полного открытия `/profile` — `/login?redirect=/profile`; приватные карточки больше недоступны.
- Ошибка настоящего недоступного API проверена до восстановления Docker; ошибка неправильного пароля 422 также проверена в форме после восстановления.

Снимки в `docs/evidence`: `final-workspace-1440.png`, `final-profile-1440.png`, `final-profile-360.png`, `final-school-switch.png`, `final-role-forbidden.png`, `final-after-logout.png`, `final-invalid-credentials.png`, `final-network-error.png`. Отдельного точного Figma-макета личного профиля/tenant selector не подтверждено: это по-прежнему композиция из согласованных токенов/layout, а не утверждение о новой pixel-perfect приёмке этих экранов.

## 6. Audit: установка проекта и production runtime

Выполнены запрошенные команды, отчёты включены:

```text
npm audit --json                         → docs/npm-audit-final.json
npm ls node-forge listhen nitropack       → docs/npm-dependency-tree.txt
npm audit --omit=dev --json              → docs/npm-audit-root-production.json
npm ls node-forge listhen nitropack --prefix .output/server
                                        → docs/npm-output-runtime-tree.txt
```

И full audit, и audit корня с `--omit=dev` показывают **7 high, 0 critical**. Это не семь независимых уязвимых алгоритмов: одна advisory GHSA-86w9-cpqp-85rv в `node-forge@1.4.0` распространяется вверх по зависимости:

```text
nuxt@4.6.2
└─ @nuxt/nitro-server@4.6.2
   └─ nitropack@2.13.5
      └─ listhen@1.10.1
         └─ node-forge@1.4.0
```

| Контур | Вывод |
|---|---|
| Корневой npm install / npm ci | Цепочка действительно установлена через `dependencies`; называть её devDependencies некорректно, `--omit=dev` её не устраняет |
| Сборка / Nuxt dev / CLI preview | Nitro tooling импортирует listhen; listhen импортирует forge и использует его для локального TLS/certificate/PFX tooling. Audit остаётся релевантным этому окружению |
| Собранный browser bundle | Клиентский transport использует Fetch/cookie; forge в клиентский auth-код не добавлен |
| Собранный `.output/server`, запуск `node .output/server/index.mjs` | `npm ls` для трёх пакетов пуст; пакетов на диске и runtime-imports нет. Node-server использует встроенные `node:http` / `node:https`, не listhen |

Production artifact реально запущен на `127.0.0.1:3001`, `/login` вернул 200. Проверка `scripts/inspect-runtime.mjs` и evidence `production-runtime.json` подтверждают пустые `installedChainPackages` и `chainImportMatches`. Единственное текстовое упоминание nitropack в renderer — комментарий о возможностях host, не импорт/исполняемый пакет.

Следовательно, данная цепочка относится к установленному build/dev/CLI toolchain, **не входит в проверенный собранный Node-server artifact**. Это не «чистый npm audit» и не доказательство отсутствия всех потенциальных уязвимостей. Если production запускается из полного корневого node_modules или через Nuxt CLI, эту границу нельзя переносить автоматически. Для deploy следует собирать в build-среде и запускать только `.output/server/index.mjs`; сам source ZIP предназначен для независимой проверки и воспроизводимой сборки. `npm audit fix --force`, downgrade Nuxt и произвольные overrides не выполнялись. Исправление chain остаётся зависимостью от совместимого upstream update, с повторной проверкой после обновления.

## 7. Повторные проверки

Node.js 24.22.1 из bundled runtime; команды соответствуют npm scripts и запущены непосредственно через тот же Node/CLI. Системный Node 24.12 не соответствует engines Nuxt 4.6.2.

| Проверка | Итог |
|---|---|
| Nuxt typecheck | PASS |
| ESLint | PASS |
| Vitest unit | PASS: 32 теста, 3 файла |
| Vitest live | PASS: 1 сценарий, 13 контрольных пунктов, реальные HTTP |
| Production build | PASS |
| Собранный production server | HTTP 200 на /login |
| Browser session/profile/school/logout | PASS, evidence перечислены выше |
| Dependency audit | 7 high toolchain findings остаются открытыми, классификация выше |

## 8. Поставка и известные ограничения

`school-events-frontend-fe001.zip` содержит актуальные package/lock, исходники Nuxt, UI-kit, unit/live tests, конфиги, Figma inventory/prototype docs, API docs, evidence и этот отчёт. Исключены node_modules, .nuxt, .output, .git, .idea, настоящие .env-файлы, ключи и сертификаты. `.env.example` содержит только публичный адрес API и путь к спецификации.

Внутри архива — `school-events-frontend/`; `docs/release-manifest.json` содержит SHA-256 каждого исходного файла (кроме самого manifest). Сборщик проверяет CRC ZIP, обязательные файлы и соответствие содержимого manifest. SHA-256 всего ZIP расположен рядом в `school-events-frontend-fe001.zip.sha256` и передаётся в сообщении поставки; он не вкладывается в сам архив, чтобы избежать циклического хеширования.

При проверке поставки CRC и manifest прошли, запрещённых записей нет. Дополнительно содержимое текстовых файлов ZIP проверено на известные длинные секретные значения из локальной backend-конфигурации: совпадений нет. Значения секретов в отчёт и журнал не выводились. SHA-256 независимо подтверждён PowerShell `Get-FileHash`.

Остаются явно незавершёнными: демовход, автоматическое восстановление пароля, remember-me (нет backend-контрактов), доменные разделы FE-002 и далее, согласованное исправление OpenAPI backend и upstream toolchain advisory. Выбор школы хранится в текущем SPA-state; после полного reload применяется серверный default — это не сохранённая на сервере пользовательская настройка. Длительное idle-истечение реальной сессии, все системные роли и все возможные аккаунтные состояния не выдаются за исчерпывающе проверенные: текущая приёмка покрывает перечисленные сценарии, включая два вида серверного отказа 403 и logout-based invalidation.

Технические проверки FE-001 выполнены; решение о независимом принятии остаётся у reviewer. **PENDING INDEPENDENT TECHNICAL REVIEW.**
