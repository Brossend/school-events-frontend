# Запуск FE-012

Нужны Docker Desktop Engine, Composer 2, Node согласно `package.json` engines. Backend размещается рядом с frontend: `school` / `schoolFrontend`. Создайте локальные `.env` из example, задайте уникальные APP_KEY и пароли; реальные файлы конфигурации не входят в поставку.

## Обычный локальный запуск

В `school`: `docker compose up -d --build postgres redis app nginx queue`. При первом развёртывании исходников установите Composer dependencies внутри PHP image (`docker compose run --rm --no-deps app composer install`). Создайте APP_KEY средствами Laravel. Если это новая пустая база, миграции выполняет оператор согласно README backend; **не запускайте migrate:fresh на существующей рабочей базе**. Проверьте `http://localhost:8000/health`.

В `schoolFrontend`: `npm ci`, затем PowerShell `$env:NUXT_PUBLIC_API_ORIGIN='http://localhost:8000'; npm run dev`. Откройте `http://localhost:3000`. Нужен существующий активный пользователь/членство; production пароли не поставляются. Для production: `npm run build`, затем `node .output/server/index.mjs` с соответствующими HOST/PORT и runtime config.

## Изолированная проверка

Настройте `.env.testing` с `DB_DATABASE=school_events_test`, `DB_USERNAME=school_test_user`, отдельным паролем и ключом. Существующий init SQL создаёт ограниченную тестовую роль; на уже инициализированном томе требуется ручная настройка DBA по backend README, без сброса тома. Команда `docker compose --profile testing up -d app-test nginx-test` поднимает API на loopback 8001. Сначала проверьте `GET /api/v1/test/environment-probe`: testing/school_events_test/school_test_user. Не запускайте live harness при другом контуре.

PHPUnit: `docker compose exec -T app-test php artisan test`. Frontend: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. JSON contract: `python scripts/validate-fe012-contract.py` (PyYAML, jsonschema).

Для live Redis E2E сначала создайте собственный набор fixture. В frontend `tests/backend/fe012-fixtures.php` есть fail-closed guard; передайте его на stdin `docker compose exec -T app-test php`, результат сохраните в `docs/fe012/evidence/test-fixtures.json`. Скрипт сам создаёт уникальный 10-значный hex `runId`; используйте его как FE012_RUN, очередь `fe012-<run>` и prefix `school_fe012_<run>_`. Смотрите env requirements непосредственно в начале harness; не выводите APP_KEY, пароли или одноразовые токены.

Из каталога backend примените дополнительный compose `-f ../schoolFrontend/tests/backend/fe012-compose.override.yml` только к app-test, задав `FE012_REDIS_QUEUE` и `FE012_REDIS_PREFIX`; пересоздайте app-test и перезагрузите nginx-test для нового upstream. Отдельный worker: `docker compose exec -T -e FE012_RUN=<run> app-test php scripts/fe012-worker.php`. Он откажется работать с иной базой/ролью/очередью.

Основной прогон frontend: `$env:FE012_ISOLATED='1'; npm run test:integration -- tests/full-stack-isolated.live.ts`. Fault harness: `tests/faults-isolated.live.ts`, только после основного прогона и проверки IDs; он использует существующий DBA лишь для временного триггера в тестовой базе и удаляет его в finally. Пароли fixture вычисляются в памяти из testing APP_KEY, в архиве их нет. Не запускайте несколько основных прогонов параллельно и не перезаписывайте принятую evidence без резервной копии.

Live harness сохраняет исходные Windows-пути `C:/Users/bross/WebstormProjects/school` и `schoolFrontend`. Для другого расположения адаптируйте пути в harness перед запуском. Исторические HTTP-audit скрипты backend требуют DEMO_*_PASSWORD из окружения; fallback пароли из поставки удалены. Не запускайте demo seeder на существующей базе ради этих проверок.

После проверки остановите свой worker, пересоздайте app-test обычным compose без override (queue sync), перезагрузите nginx-test, завершите тестовую браузерную сессию. Верните frontend API origin 8000. Все эти шаги действуют только на локальный тестовый контур; очистка пользовательских данных не нужна.
