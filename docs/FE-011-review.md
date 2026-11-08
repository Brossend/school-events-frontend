# FE-011 — профиль школы, системный статус и культурный каталог

Дата приёмочного прогона: 30 октября 2026, Asia/Yekaterinburg. **Статус: PENDING INDEPENDENT REVIEW.** Реализация и техническая проверка FE-011 завершены; это не утверждение о независимой продуктовой приёмке или готовности всех backend-функций. FE-012 не начат. Laravel и Figma не изменены.

## Готовые действия

- `/school`: чтение реальных реквизитов, пяти поддерживаемых settings, региона, дат, active_teachers_count и traditions_count. Администратор своей школы редактирует разрешённые поля; педагог просматривает. Системный администратор без членства открывает конкретную существующую школу по UUID и сохраняет в пределах действующего Laravel API. Регион и вычисляемые показатели read-only.
- Настройки — address/phone/email/website/description, без произвольного JSON. PATCH передаёт только разрешённые изменения; merge сервера сохраняет остальные settings. Инициализация, клиентские и серверные 422, подтверждение критичных реквизитов, сохранение ввода, повторный GET, конфликт и неизвестный результат обработаны.
- `/profile` сохраняет реальные сведения пользователя, членства, роли и выбор школы; добавлена ссылка на реквизиты. Новых операций над пользователями, паролями и ролями нет.
- `/system`: только фактические system_status и system_role. Системная роль не считается школьным членством. Инфраструктурных метрик и вымышленного управления организациями нет.
- `/catalog`: серверная очередь с фильтром/пагинацией, открытие source/claim по ID, просмотр источника, изменение библиографии, экспертное решение с обоснованием, история рецензий, attach конкретному claim и подтверждаемый detach всех активных записей выбранной пары claim/source. Серверные отказы отображаются.
- Навигация учитывает системные полномочия. Карточки source/claim FE003 связаны с каталогом. SourceContent, ClaimContent, EvidenceRecord, SourceInspector и ProvenanceStatus переиспользованы.

Одобрение источника не подтверждает автоматически утверждения. Checkbox verification изначально выключен и отправляет явный false. Отозванное evidence показывает «Свидетельство отозвано», а не зелёный статус. После мутаций серверные сведения перечитываются; устаревший допуск очищается до GET. Автоматической повторной подписи сценариев нет.

## Надёжность и независимое код-ревью

[Независимое код-ревью](fe011/independent-code-review.md): повторная проверка закрыла R1–R4 и дополнительный cross-source rebase случай. Открытых замечаний в этой области нет. Сохранены 29 новых регрессионных тестов в `tests/fe011-review-regressions.test.ts`; независимый focused run — 143/143, полный родительский — 588/588.

1. Принятая запись с неудачным последующим GET имеет отдельную блокировку новых мутаций/выбора объекта до полной GET-сверки. Она не объявляется неотправленной и не повторяется.
2. Неизвестный исход network/408/5xx также блокирует новую запись. Перед каждой сверкой сбрасывается прежний флаг успеха; неполная история рецензий не считается успешным восстановлением. Обычный просмотр может показать источник с явной ошибкой истории.
3. При смене principal, system role, school role или tenant очищаются сведения, черновики, решения, source IDs, цитаты и verification. Поздние ответы прежнего контекста отбрасываются.
4. Конфликт библиографии показывает прежние и свежие значения. Явное обновление основы сохраняет изменённые пользователем поля, берёт свежие нетронутые поля с сервера и требует нового подтверждения. При выборе другого источника прежний конфликт очищается.

Ошибки GET-preflight не называются неизвестной записью. Двойная отправка заблокирована. Существующая одноразовая CSRF-перепроверка после известного 419 сохраняется и покрыта регрессией; неизвестные мутации не повторяются. Preflight не даёт атомарной optimistic concurrency: у source/evidence нет version/ETag/Idempotency-Key. Причина detach обязательна в UI и ограничена 2000 символами как сознательное продуктовое ограничение; Laravel допускает отсутствие reason без этого максимума.

## Figma и визуальная проверка

[Figma inventory](fe011/Figma-inventory.md), [school layout](fe011/figma/school-layout-handoff.md): исследованы desktop/tablet/mobile/compact варианты 1440/768/390/360, source/reliability modal, культурные карточки, протокол проверки и встроенные экспертные блоки. Сохранены 20 design contexts, 20 metadata, 20 reference PNG и 79 точных SVG. Файл Figma не менялся.

Профиль школы следует подтверждённой композиции Figma: desktop form + hints; tablet одна колонка; mobile перенос сохранения вниз, последовательные поля. Не поддержанные сервером учебный год, класс, длительность и ресурсы не выданы за работающие настройки. Очередь, формы bibliography/review/history/attach/detach и системная страница собраны из принятого UI-kit: отдельные макеты этих операций в Figma не найдены. Переполнение исходного source-overlay не копируется в приложение.

[37 реальных снимков и геометрия](fe011/screenshots/metadata.json): девять обязательных состояний × четыре ширины, плюс отозванное evidence. Источник — действительная авторизация и API app-test, а не fixture UI. Показаны synthetic labels, секретов нет, видимые SVG загружены. Профиль, черновик и ошибки формы; системный статус; очередь; экспертное решение; attach; detach confirmation; история — сохранены во всех четырёх размерах.

Проверены полноразмерные снимки и контактный лист. На планшете исправлено переполнение девяти ссылок системной роли переносом навигации; контрольные снимки обновлены. Горизонтального переполнения документа/диалога нет. При вертикальной полосе прокрутки bitmap full-page уже заданной ширины на 15px; metadata сохраняет запрошенный viewport и реальный scrollWidth. Focus-visible рамка ссылки перехода к содержимому может присутствовать на снимках клавиатурного фокуса и не является частью макета.

[Браузерная проверка](fe011/evidence/browser-verification.json): school_admin видит собственную школу, 2 активных педагогов/1 традицию, ввод и ошибки сохраняются. `/profile` показывает совпадающее членство. system_admin без членства открывает школу по UUID; `/system` возвращает operational. Очередь, история и SourceInspector загружены; checkbox false; диалог detach отменён, sibling evidence не изменено. Primary claim действительно отозван. После выхода защищённый каталог перенаправляет на `/login?redirect=/catalog`.

В этом браузерном проходе проверялись чтение, черновики и отменяемые подтверждения. Реальные серверные 422 и изменения PostgreSQL подтверждены отдельным HTTP-прогоном ниже; они не подменяются клиентскими ошибками со снимков.

## Реальные HTTP и PostgreSQL

[Evidence README](fe011/evidence/README.md), [HTTP](fe011/evidence/http-admin.json), [validation](fe011/evidence/validation.json). Изолированный run `f7b999d3d1`: localhost:8001 → app-test → school_events_test, environment testing, DB role school_test_user, queue sync. Прогон прошёл за 234.22 секунды: **94 HTTP-ответа**, статусы 200/201/202/204/401/403/404/409/422. 111 собственных transport log lines включают сохранённые discovery attempts; это не 111 успешных приёмочных ответов.

Проверены teacher, school_admin, catalog_curator с региональными ограничениями, system_admin без членства, две школы региона 66 и школа региона 77. Чужой школьный профиль, региональные/федеральные мутации и история без полномочий отклоняются. Видимость федерального source в очереди не означает права изменения. Ошибочный школьный PATCH422 не меняет БД; settings merge сохраняет существующий адрес. Системная роль не подменяется школьным членством.

PostgreSQL snapshots: before, verified, amended, reverified, signed-export, after. [Diff](fe011/evidence/postgres-diff.json): source_reviews 2→6 (+4), evidence 2→2, audit 3→9 (+6), scenario 0→1, export_job 0→1. Начальный снимок намеренно сохраняет discovery attempts. Предыдущие evidence/audit IDs и audit content не удалялись. Primary evidence проходит verified → amendment/unverified → explicit reverify → detached/unverified; sibling остаётся verified.

Собственный сценарий реально сгенерирован, проверен, подписан; готовый [DOCX](fe011/evidence/documents/fe011-own-scenario.docx) скачан через authenticated API. Его размер/SHA256 сверяются с artifact receipt. После detach старый download даёт403, новый export403, persisted ready artifact остаётся с is_downloadable=false. Старый sign-off автоматически не восстанавливается. Stale revision PATCH409 не создаёт новую revision.

[11 исходных backend hashes](fe011/evidence/backend-readonly-sha256.json) сверены: backendChanged=[], secretFound=false. Мутации выполнялись только над собственными изолированными fixtures. Пароли выводились в памяти из testing APP_KEY; паролей, ключей, cookies или токенов в evidence нет.

## Финальные проверки

[Машиночитаемые результаты](fe011/evidence/final-checks.json):

| Проверка | Результат |
| --- | --- |
| npm run typecheck | PASS, exit 0 |
| npm run lint | PASS, exit 0 |
| npm test | PASS, 588 тестов / 19 файлов; включает 469 прежних тестов |
| npm run build | PASS, Nuxt 4.6.2 / Nitro 2.13.5; обычный API8000 |
| Реальный isolated HTTP | PASS, 94 ответа; PostgreSQL receipts сохранены |
| Production smoke | PASS: 5 HTML-маршрутов и 11 emitted assets, config API8000 |

Логи: `fe011/typecheck.log`, `eslint.log`, `vitest.log`, `production-build.log`. [Production smoke](fe011/evidence/production-smoke.json) проверяет SPA shell/config/assets; авторизованные действия проверялись отдельно в app-test. HTTP200 shell не считается обходом клиентской защиты.

[Восстановленный runtime](fe011/evidence/restored-runtime.json): dev localhost:3000 использует API localhost:8000; тестовая сессия завершена; временный production preview3111 остановлен; базовый app-test queue sync. API8001 не оставлен обычным frontend runtime.

## API gaps и FE-012

[Контракт школы](fe011/school-contract.md), [контракт каталога](fe011/catalog-contract.md) документируют реальные JSON и узкие типизированные overrides неполного OpenAPI. Новых серверных операций frontend не создаёт.

Открыты: cultural A/B status/effective_status; отсутствие чтения текущего экспертного заключения/истории пилота; слабая comparison_id validation; неполный OpenAPI/даты календаря; MockLlmProvider family failure. Дополнительно реальные страницы очереди при одинаковом created_at пересекаются без id tie-breaker. Latest review при этом согласован с PostgreSQL reviewed_at DESC,id DESC.

После bibliographic amendment локальный controller содержит создание per-claim invalidation audit, но реальный HTTP claim GET не вернул ожидаемое событие. Это расхождение сохранено как ограничение, а не объявлено работающим аудитом. Attach/reverify/detach audit действительно сохранён; его нельзя выдавать за отсутствующее amendment event. См. [discovery](fe011/evidence/http-amendment-discovery.json) и [pagination](fe011/evidence/http-pagination-discovery.json).

[Точный минимальный план FE-012](fe011/FE-012-backend-plan.md) задаёт области исправлений и критерии HTTP/PostgreSQL-регрессии, включая проверку исполняемого runtime перед изменением уже существующего audit-кода и отдельное согласование concurrency/idempotency. Это только план. Ни один backend gap не исправлялся скрыто в FE-011. Production LLM не подключена.

## Поставка

Архив `school-events-frontend-fe011.zip` включает актуальные package.json/package-lock.json, исходники, UI-kit, тесты, Figma/API документы и evidence FE001–FE011. Исключены node_modules, .nuxt, .output, .git, private .env, credentials/session material и предыдущие ZIP. `.env.example` содержит публичный API origin и путь к локальному OpenAPI, без секретов.

`docs/fe011-release-manifest.json` фиксирует каждый payload size/SHA256. Скрипт `scripts/verify-fe011-release.py` проверяет ZIP CRC, состав, manifest, backend hashes, известные/вычисленные секреты всех fixture runs, HTTP/PostgreSQL/DOCX receipts, четыре ширины и runtime. Внешний `.zip.sha256` и финальное сообщение содержат SHA256 архива: сам digest не включён внутрь этого документа, чтобы избежать самоссылочного хеша. Результат внешнего read-only verifier поставляется рядом с архивом.
