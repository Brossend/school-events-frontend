# UX-001 — Teacher Experience, Registration & Real Content

Статус: **UX-001 IMPLEMENTED — PENDING INDEPENDENT REVIEW**. Дата: 9 ноября 2026 года.

Изменения находятся в ветке `feature/ux-001-teacher-experience` обоих репозиториев. Merge, push, production deploy, изменения VPS, DNS, production ENV и production volumes не выполнялись. Проверки проведены локально. Этот отчёт не является независимой педагогической приёмкой.

## Результат по 11 замечаниям

| № | Замечание | Реализация и проверка |
|---|---|---|
| 1 | Неработающий демовход | Кнопка и её обработчик удалены. Обычный вход, приглашение и регистрация доступны; тест LoginForm и browser login проходят. |
| 2 | Favicon | Собственный знак существующей айдентики: ICO, SVG, PNG 16/32/192/512, Apple Touch Icon, manifest и Nuxt head. Все 8 ресурсов возвращают 200. |
| 3 | Логотип-ссылка | Убрано подчёркивание, сохранён переход на главную, добавлены hover и видимый keyboard focus. |
| 4 | Технический язык | Общий teacher-language переводит пути полей и ошибки; пользовательские статусы и инструкции переписаны. Диагностика провайдера/идентификаторов сценария раскрывается системному администратору. Предупреждения качества, источников и тестовой генерации сохранены. |
| 5 | Конструктор | Пять шагов, обязательные поля, локальные ошибки с переходом к полю, сохранение значений при возврате, краткая сводка. Все шаги и ошибка первого шага проверены на 4 ширинах. Последнее действие честно называется «Сохранить условия»: генерация требует следующего отдельного подтверждения. |
| 6 | Готовый сценарий | Краткие характеристики, оглавление, редактирование, материалы, источники и отдельные итоги проверок. История ревизий, optimistic lock, P0/P1, Provenance Gate, подтверждение педагогом и серверный допуск экспорта сохранены. |
| 7 | Исследования | Новый раздел «Исследования и сравнения» объединяет входы в A/B и пилот. Из сценария есть переход к сравнению условий. Навигация не расширяет серверный RBAC, результаты пилота не создаются. |
| 8 | Регистрация | Серверные одноразовые приглашения, создание/список/отзыв администратором, ручное копирование кода, форма /register. Проверены CSRF, роли, чужая школа, истечение/отзыв, повторное использование и конкурентные запросы. |
| 9 | «Запомнить меня» | Штатный Laravel web guard: 30 дней, recaller cookie, восстановление без прежней сессии, отзыв при logout. Вход без checkbox удаляет cookie прежнего аккаунта. Автотесты проверяют срок, флаги и восстановление. |
| 10 | Реальный календарь и чистая практика | 36 записей с источниками; отдельный Docker project и БД без demo-seeder. Read-only inventory вместо удаления существующей общей БД. Нулевые сценарии, сравнения и экспорты подтверждены запросом к practice DB. |
| 11 | Адаптивность и вложенные состояния | Основные страницы, 5 шагов, ошибки, сценарий, редактор и экспорт проверены на 1440×900, 768×1024, 390×844, 360×800. Отдельно сохранены browser matrix, скриншоты и предыдущие интеграционные результаты. |

## Область изменений

Frontend: /login, /register, /invitations, /research, /, /calendar, /constructor, /events, /comparisons, /pilot, /school, /profile, /scenario-requests/:id, /generation-runs/:id, /scenarios/:id и /scenarios/:id/edit. Основные компоненты: LoginForm, AppNavigation, UiSelect, ScenarioResult, ScenarioJson, ScenarioQualityNotice, ScenarioEditorWorkspace, ScenarioEditFields, RevisionFields, RevisionModeration, TeacherSignoffForm, ExportPanel/ExportJobState, GenerationLaunchPanel/GenerationState, школьный профиль и пилот. Общие подписи и пути сосредоточены в app/utils/teacher-language.ts; адаптивные уточнения — в ux001.css и существующих стилях.

Сохранены Inter, компоненты Ui*, палитра и композиция Сбер × УрФУ. Использованы ранее полученные контексты [Figma](https://www.figma.com/design/yM3uywBNWGprDE61hxKK3V/) и [инвентаризация 20 вариантов конструктора](fe005/figma-node-inventory.md). Pixel-perfect совпадение не заявляется: тексты и поля соответствуют действующему контракту.

Backend: AuthController/LoginRequest, RegistrationController/RegisterRequest, SchoolInvitationController/StoreSchoolInvitationRequest, SchoolInvitation и SchoolInvitationPolicy; rate limiters в AppServiceProvider, routes/api.php, OpenAPI и сгенерированные frontend types. Также убраны технические подсказки из ответов dashboard/mock-сценария и добавлен отдельный тип официального источника.

Миграции:

- 2026_11_09_093911_create_school_invitations_table.php — приглашения и ограничения.
- 2026_11_09_100127_add_official_publication_source_type.php — расширение допустимых типов источника. Откат отказывается удалять тип, пока он используется; данные не переклассифицируются автоматически.

Новые API: POST /api/v1/auth/register; GET/POST /api/v1/schools/{schoolId}/invitations; POST /api/v1/schools/{schoolId}/invitations/{invitationId}/revoke. Существующий login принимает boolean remember. OpenAPI и app/types/openapi.d.ts синхронизированы повторной генерацией.

## Приглашения и авторизация

Код — 32 случайных байта (64 hex-символа); БД хранит SHA-256. Исходный код возвращается только при создании, с Cache-Control: no-store, и не включён в список приглашений. Срок по умолчанию 7 дней. Администратор передаёт код вручную: email-рассылка не имитируется.

Проверка выполняется сервером. Транзакция и row lock защищают погашение; advisory lock нормализованного email защищает конкурирующие регистрации по разным приглашениям. Проверяются адрес, срок, отзыв, использование, уникальность пользователя. School/teacher-role берутся из приглашения, внедрение роли и школы отклоняется. Публичный конфликт не раскрывает чужой аккаунт. Гонки дают ровно 201+409, одного пользователя и одно членство. Обычная регистрация не добавляет членство существующему пользователю.

School admin управляет приглашениями своей школы; системный администратор использует явно выбранную школу; teacher/guest не управляют приглашениями. Frontend очищает показанный код при смене пользователя, школы или полномочий и игнорирует устаревшие ответы. Rate limiting регистрации: 5/min и 30/hour; создания приглашений: 10/min. Stateful-запросы используют существующую CSRF/Sanctum схему. Формы входа/регистрации имеют method=post, чтобы native-submit до гидрации не помещал пароль в URL.

Remember Me использует recaller Laravel на 30 дней, HttpOnly, SameSite=Lax, Secure при HTTPS-конфигурации; локальное HTTP-окружение использует Secure=false. Без checkbox действует стандартная политика сессии. Пароли и сессионные токены не сохраняются в localStorage. Logout инвалидирует текущую сессию, обновляет CSRF и remember token. Старые recaller cookies других браузеров перестают восстанавливать вход; уже открытые независимые сессии других устройств штатным logout автоматически не завершаются. Это поведение задокументировано и не выдаётся за глобальный выход со всех устройств.

## Календарь и чистая БД

Manifest: backend database/data/ux001-calendar-2026-2027.json — **36 уникальных записей: 35 федеральных и 1 региональная**. Это выбранные проверенные даты, не полный обязательный план школы. Школьные события без подтверждения не добавлялись. Для каждой записи сохраняются название, описание, тип, дата occurrence, направление и ссылка на источник. Подтверждённая возрастная аудитория источником не установлена, поэтому массив аудитории пуст; направление обозначено редакционной рекомендацией.

| Источник | Использование и проверка |
|---|---|
| [Минпросвещения: календарь 2026/2027 на сайте ФЦРВ «Смена»](https://fcrv.smena.org/wp-content/uploads/perechen-meropriyatij-kalendarnogo-plana-2026-2027.pdf) | 35 федеральных дат, приложение с. 41–44. HTTP 200, 49 страниц, 1 155 482 байта. SHA-256 b015d681d23768eacaccb4315a9a5ee8beaf623cb0ddb47c3f27c7a709c89680. [Извлечение страниц](ux001/evidence/calendar-source-extract.txt). Проверены в том числе подвижные даты: 18.10, 26.10, 29.11.2026; 26.06 и 14.08.2027. |
| [Областная газета, 10.09.2026](https://oblgazeta.ru/politics/governor/2026/09/163803/) | День образования государственных архивов Свердловской области, 10 сентября; основание и принадлежность региону отражены в manifest. |

Наличие официальной публикации не означает проверку культурных утверждений будущего сценария. Источники imported как official_publication; культурная достоверность автоматически не подтверждается. Provenance Gate продолжает действовать.

Практическое окружение: project school-ux001; БД school_events_ux001; собственные postgres/redis/storage volumes и внутренняя сеть; наружу доступен только loopback API 8020. Backend и worker принудительно используют отдельные DB/Redis/config-cache. Launcher проверяет параметры private env, игнорирует унаследованные COMPOSE_* и не запускает demo-seeder. Пароль первого администратора вводится скрыто; секреты хранятся вне Git.

Свежая проверка: **2 users, 1 school, 36 calendar_events, 0 scenarios, 0 comparisons, 0 export_jobs, 0 artifacts**. Два пользователя — bootstrap admin и педагог, зарегистрированный по приглашению. [SQL counts](ux001/evidence/clean-counts.txt), [read-only inventory](ux001/evidence/clean-practice.txt).

Для чистого старта выбран явно разрешённый ТЗ путь: новая изолированная БД. Команда practice:inspect показывает только явно маркированные синтетические записи и зависимые итоги, ничего не удаляет. Существующие общие базы не очищались. Массовый TRUNCATE, migrate:fresh общей БД и удаление volumes не выполнялись. Fresh/upgrade миграции в тестах работают во временных тестовых схемах. Импорт идемпотентен; проверки действительной write DB, production refusal и повторного bootstrap включены в тесты.

## Проверки

| Проверка | Итог | Доказательство |
|---|---|---|
| FE typecheck | PASS | [log](ux001/evidence/typecheck.txt) |
| FE ESLint . | PASS | [log](ux001/evidence/lint.txt), пустой вывод при exit 0 |
| FE Vitest | 24 файла, 635 тестов PASS | [log](ux001/evidence/vitest.txt) |
| FE финальные UX forms regressions | 12 тестов PASS, включая method=post | [log](ux001/evidence/ux001-final-targeted.txt) |
| FE production build | PASS, Node 24.22, 3m09s | [log](ux001/evidence/build.txt) |
| OpenAPI types | Повторная генерация совпала по SHA-256 | npm run api:generate |
| BE полный PHPUnit | 455 tests / 2242 assertions; 0 failures/errors/skipped | backend docs/ux001/evidence/backend-full-suite.log и .xml |
| BE приглашения/Remember | 28 tests / 133 assertions | backend backend-focused.log/.xml |
| BE calendar/bootstrap/isolation | 17 tests / 198 assertions | backend backend-calendar.log/.xml |
| BE Pint | PASS | backend backend-pint-workspace-final.log |
| Browser production preview | Основные маршруты + вложенные состояния, 4 разрешения; без pageerror/overflow; icons 200 | clean/browser-verification.json и deep/browser-verification.json |

Backend PHP 8.4.27 / PHPUnit 12.5.40. Полная suite выполнена в отдельной схеме ux001_backend_review_62a29e01362a внутри school_events_test из container snapshot /tmp/ux001-review. Browser fixture в public сохранена. Fresh и upgrade migrations сохраняют существующего пользователя. Реальные параллельные процессы проверили одно приглашение/разные email и разные приглашения/один email. Ранее семь bootstrap tests падали из-за предположения о пустоте общей БД; после изоляции в собственных временных схемах весь набор прошёл. Первоначальные неуспешные логи сохранены backend отдельно, финальный файл называется backend-full-suite.

Интеграция HTTP в более раннем локальном прогоне этой же задачи: admin login 200 → invite → race 201+409 → teacher login 200; teacher invite 403; revoked invite 422; request/mock generation accepted; edit 201, stale revision 409, verification 202, signoff 200; PDF/DOCX/PPTX готовы и скачаны с 200, размерами и SHA-256. [HTTP](ux001/evidence/earlier-http-results.json), [lifecycle](ux001/evidence/earlier-lifecycle-results.json), [downloads](ux001/evidence/earlier-download-results.json). Это исторические receipts задачи, не утверждение, что эти сценарии сейчас присутствуют в чистой БД. Дальнейшая backend regression проверяет финальный код, браузер проверяет production build.

## Визуальная проверка

Доказательства разделены по окружению: clean — production preview localhost:3030 / API 8020, чистая практика; deep — production preview localhost:3000 / API 8001, отдельные тестовые fixtures сценария и редактора. Пароли, cookies и коды приглашений не сохраняются в screenshots/evidence. Смешанные снимки ранних одновременных прогонов исключены из комплекта.

| Состояние | Desktop | Tablet | Mobile 390 | Mobile 360 |
|---|---|---|---|---|
| Реальный календарь | [1440](ux001/evidence/clean/screenshots/calendar-1440.png) | [768](ux001/evidence/clean/screenshots/calendar-768.png) | [390](ux001/evidence/clean/screenshots/calendar-390.png) | [360](ux001/evidence/clean/screenshots/calendar-360.png) |
| Регистрация | [1440](ux001/evidence/clean/screenshots/register-1440.png) | [768](ux001/evidence/clean/screenshots/register-768.png) | [390](ux001/evidence/clean/screenshots/register-390.png) | [360](ux001/evidence/clean/screenshots/register-360.png) |
| Ошибки конструктора | [1440](ux001/evidence/deep/screenshots/constructor-errors-1440.png) | [768](ux001/evidence/deep/screenshots/constructor-errors-768.png) | [390](ux001/evidence/deep/screenshots/constructor-errors-390.png) | [360](ux001/evidence/deep/screenshots/constructor-errors-360.png) |
| Сценарий | [1440](ux001/evidence/deep/screenshots/scenario-1440.png) | [768](ux001/evidence/deep/screenshots/scenario-768.png) | [390](ux001/evidence/deep/screenshots/scenario-390.png) | [360](ux001/evidence/deep/screenshots/scenario-360.png) |
| Редактор | [1440](ux001/evidence/deep/screenshots/editor-1440.png) | [768](ux001/evidence/deep/screenshots/editor-768.png) | [390](ux001/evidence/deep/screenshots/editor-390.png) | [360](ux001/evidence/deep/screenshots/editor-360.png) |
| Диалог экспорта | [1440](ux001/evidence/deep/screenshots/export-1440.png) | [768](ux001/evidence/deep/screenshots/export-768.png) | [390](ux001/evidence/deep/screenshots/export-390.png) | [360](ux001/evidence/deep/screenshots/export-360.png) |

Все пять шагов находятся рядом как constructor-step{1..5}-{width}.png. Основной прогон включает dashboard, invitations (интерфейс администратора), research, comparisons, pilot, school, traditions, events и profile. Пустые состояния проверены в чистой базе. [Clean matrix](ux001/evidence/clean/browser-verification.json), [deep matrix](ux001/evidence/deep/browser-verification.json). Матрица сохраняет фактический path, heading и количество dialog, проверяет неожиданный redirect/error page. Дополнительный прогон: 40 состояний без overflow/pageerror; раскрытые поля редактора, история версий, окно подтверждения и окно традиции — [nested matrix](ux001/evidence/nested/browser-verification.json), [мобильный обзор](ux001/evidence/nested/contact-mobile.jpg). Основной и deep прогоны: 52 и 44 состояния соответственно. Числа включают повторные снимки общих экранов и не означают 136 уникальных страниц. Browser harness: scripts/ux001-browser-check.mjs, использует локальный Playwright runtime без изменения package dependencies.

До/после: [старый login](ux001/evidence/before/login-1440.png) → [новый](ux001/evidence/clean/screenshots/login-1440.png); [конструктор FE-005](ux001/evidence/before/constructor-1440.png) → [новый](ux001/evidence/deep/screenshots/constructor-step1-1440.png); [сценарий FE-006](ux001/evidence/before/scenario-390.jpg) → [новый](ux001/evidence/deep/screenshots/scenario-390.png). «До» — исторические материалы этапов FE, а не повторное открытие старого deployed приложения; данные сценариев различаются. Более ранняя [матрица](ux001/evidence/earlier-viewport-matrix.json) включает в том числе окно традиции и успех регистрации; она дополнение, не финальный прогон.

Визуально просмотрены мобильные constructor errors/review, сценарий, редактор и окно экспорта. Текст и действия помещаются по ширине, длинные заголовки переносятся, окно экспорта имеет собственную прокрутку. Это проверка разработчиком; полноценное исследование с педагогами и исчерпывающая проверка всех административных CRUD/dropdown состояний не заявляются.

## Ограничения и решения

- Реальная LLM локально выключена. Mock-проект явно помечен тестовым и требует доработки; он не считается готовым интеллектуально созданным материалом.
- Email delivery и password reset не реализованы. Приглашение передаётся вручную; потерянный код требует нового приглашения.
- Календарь выбранный, аудитория не выдумана; источник не подтверждает автоматически культурную интерпретацию и не обязывает школу проводить мероприятие.
- У конструктора последний шаг сохраняет условия, затем отдельное подтверждение запускает генерацию. Это сохраняет существующий безопасный workflow вместо ложной подписи «Создать сценарий» на операции сохранения.
- Предметно сложные части сохранены: отдельные качество/модерация/источники/подтверждение, разрешение конфликтов версий и экспорт после допуска. Они объясняют реальные требования и не объединены в фиктивный «всё проверено».
- Отдельный destructive cleanup не добавлен: чистота достигается новой изолированной средой, inventory только читает. Уже существующие чужие записи не удаляются.
- Проверка выполнена на Chromium; Safari/Firefox и реальные мобильные устройства независимо не проверены. Приёмка реальными педагогами и пилот с участниками ещё нужны. Нельзя присваивать CLOSED по этой реализации.

## Локальный запуск и ручная приёмка

Из backend, Docker Desktop включён, Python 3.10+:

~~~powershell
python scripts/ux001-local.py
python scripts/ux001-local.py --start
docker exec school-ux001-app-1 php artisan practice:calendar
docker exec school-ux001-app-1 php artisan practice:calendar --apply --no-interaction
docker exec -it school-ux001-app-1 php artisan practice:bootstrap --email=admin@example.test --school="Моя школа"
docker exec school-ux001-app-1 php artisan practice:inspect --dry-run
~~~

Первая команда — dry-run. Bootstrap только для первого администратора пустой отдельной БД; не перезаписывает пароль существующего пользователя. Ввод пароля скрыт, нет параметра с plaintext паролем. Private env: ~/.codex/ux001/practice.env; в Git не добавлять.

Из frontend, Node 24.15+:

~~~powershell
npm ci
$env:NUXT_PUBLIC_API_ORIGIN='http://localhost:8020'
npm run dev -- --port 3030
~~~

Открыть http://localhost:3030 (один hostname localhost для frontend/API). Для production preview: npm run build, затем PORT=3030 и node .output/server/index.mjs с тем же NUXT_PUBLIC_API_ORIGIN. Проверки: npm run typecheck; npm run lint; npm test; npm run build. Backend reproduction и сводка — docs/ux001/evidence/backend-reproduce.md и backend-test-summary.json в backend.

Последовательность независимой проверки:

1. Войти bootstrap admin; на странице приглашений создать код, скопировать и передать отдельному браузеру. Код не должен появиться повторно в списке.
2. Зарегистрировать педагога; войти с checkbox; закрыть/открыть браузер и проверить восстановление. Выйти и проверить, что старый cookie не даёт вход. Проверить вход без checkbox.
3. Убедиться, что педагог не может создавать приглашения и видеть чужую школу. Отозвать другое приглашение; его регистрация должна отклоняться. Повтор первого кода тоже отклоняется.
4. Открыть календарь, выбрать событие, пройти пять шагов. Проверить ошибки обязательных полей и возврат назад; сохранить условия, отдельно подтвердить тестовую генерацию.
5. Прочитать сценарий и замечания, открыть редактор, исправить материал, сохранить новую версию. Из двух вкладок проверить конфликт устаревшего сохранения. Выполнить проверки и отдельное подтверждение педагогом; скачать доступные форматы.
6. Повторить основные действия на четырёх размерах, проверить focus/клавиатуру, окна и прокрутку. После генерации practice DB закономерно перестанет иметь нулевые сценарии: начальный clean-counts receipt фиксирует состояние до этого шага.

## Коммиты

Frontend implementation: 1c2b683e932ae7840df40363bf6702eb4ee0c8f3.

Backend implementation: 36ffbf600800ddd128ea0c3afd880844f21b159e.

Отчёт и screenshots могут входить в следующий документационный коммит. Оба SHA относятся только к локальной feature-ветке; публикация не выполнялась.
