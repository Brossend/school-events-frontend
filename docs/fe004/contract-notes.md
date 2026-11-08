# FE-004 · Контракт и границы

Сверены `../school/docs/openapi.yaml`, SchoolTraditionController, CreateTraditionRequest, UpdateTraditionRequest, CreateTraditionVersionRequest, IdentifyTenantScope и модели. Backend не изменялся; generated openapi.d.ts не редактировался.

| Пробел OpenAPI | Действительный Laravel / frontend |
|---|---|
| GET schools/{schoolId}/traditions: query отсутствует | Сервер принимает is_archived=false/true/all. Узкое типизированное расширение TraditionOperationOverrides добавляет только этот параметр. |
| List DTO не содержит is_archived | Сервер отдаёт boolean. parseTraditions требует его и полную versions, не выдаёт отсутствие истории за ноль. |
| active_version/versions в detail описаны как generic objects | Runtime адаптер AnnualVersion проверяет id, academic_year, notes, created_at и JSON object/array parameters_snapshot. Исторические массивы также отображаются без изменения. |
| POST create и POST versions: у 201 нет content | Оба возвращают JSON data. Локальный override описывает реальные ответы. После записи выполняется отдельный GET. |
| parameters_snapshot: пустой object без свойств | Laravel принимает array; фронтенд передаёт непустой JSON object со снимком действительной концепции, планируемой датой и участниками. Пустой объект не отправляется, поскольку required+array не принимает пустой массив. |
| Archive TraditionSummary требует описание и год | Archive реально отдаёт id/title/is_archived/updated_at. Этот ответ не используется для замены полного detail: данные перечитываются. |
| Ограничения полей | Create: title 3–255, description ≥10, established_year 1800–2100. Patch: description ≤5000, год ≤текущего календарного года. Формы учитывают различие. Annual notes ≤2000, academic_year строго YYYY-YYYY из последовательных лет. |

`active_version` определяется сервером как последняя по created_at, не максимальный academic_year. История сохраняет серверный порядок; число версий берётся из полного массива, а не из номера года.

Версии append-only, отдельных PATCH/DELETE version нет. Дубль года отдаёт 422 TRADITION_VERSION_ALREADY_EXISTS и поле academic_year. В PostgreSQL действует uq_tradition_academic_year; параллельный HTTP проверил один успех и один 422 без 500. Новая версия доступна любому участнику активной школы; patch/archive только автору, school_admin либо system_admin. Фронтенд скрывает действия на основании реального created_by_user_id, а сервер остаётся окончательным контролем прав.

Системный администратор тоже должен иметь активное членство для прохождения tenant middleware. Внутренняя ветка контроллера isSystemAdmin сама по себе не обходит этот middleware; frontend не предоставляет произвольный ввод чужого schoolId. Архивированные традиции сервер позволяет редактировать/дополнять версиями; UI не выдумывает запрет, но явно сообщает, что новая версия не снимает архив. RESTORE/DELETE tradition нет — кнопки не добавлены.

Создание новой версии не создаёт сценарий, не запускает ИИ и не наследует проверку источников. Поля класса/числа учеников/длительности из Figma не подставлены: контракт традиций не содержит соответствующей ссылки на сценарий. FE-005 не реализован.

Прежние ограничения /auth/me, generic DTO provenance и отсутствие date_type/fixed_month/fixed_day/occurrences календаря сохранены в документации FE-001—003. Их решение не включено в FE-004.
