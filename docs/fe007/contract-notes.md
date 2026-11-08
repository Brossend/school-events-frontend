# FE-007 — Сверка OpenAPI / Laravel

Исследованы ScenarioController, ScenarioRevisionController, RevisionModerationController, TeacherSignoffController, ScenarioSchemaValidator, ScenarioSemanticValidator, ModerationEngineService и ProvenanceVerificationService. Исходный backend не изменялся. Снимок OpenAPI — `openapi.yaml`, полная вложенная схема — `scenario.schema.json`.

| Предмет | OpenAPI / постановка | Действительный Laravel / решение frontend |
|---|---|---|
| Request-классы | UpdateScenarioRevisionRequest / TeacherSignoffRequest | Это имена schema в OpenAPI; контроллеры принимают обычный Request и inline Validator. Прочитаны реальные контроллеры. |
| Ревизия | JSON content_json в ранней постановке | `content_payload`; используются только пять разрешённых полей PATCH. |
| Замысел / цель | minLength 30 / 20 | Inline Validator 20 / 15, но полная JSON schema всё равно 30 / 20. UI сохраняет более строгие минимумы и показывает 422 целиком. |
| stages / tasks / materials | Общий object в OpenAPI | Генерируемые типы получаются Record<string, never>. Локальный EditorOperationOverrides уточняет JSON body, сгенерированный openapi.d.ts не редактировался. |
| PATCH | Номер ревизии и If-Match | If-Match из `optimistic_lock_version` GET Scenario, не version_number. 201 создаёт N+1, автоматически ставит новую модерацию; после ответа выполняются свежие GET. |
| Этапы | Вложенная структура не раскрыта OpenAPI | stage ID и внешние связи сохраняются; порядок меняется через order_index. Редактируются заголовок, тип, длительность, действия, реплики, подсказки и переход. Добавление/удаление этапов не предлагается: связанные activities вне разрешённого PATCH. |
| Материалы | Общий object | presentation_slides, printable_cards, handouts по полной schema, включая заметки ведущего, текст шаблонов и количество. Состав разделов не редактируется за пределами разрешённых данных. |
| Проверка ещё не запускалась | verification_run_id обязателен UUID, enum без pending | Реальный GET даёт null, pending_verification, 0/0/[]; runtime adapter поддерживает. |
| Статусы | GET verification: passed / warnings / blocked | moderation_state: verification_passed / verification_passed_with_warnings / verification_blocked. Различие адаптировано, running/pending/failed_engine не считаются успехом. |
| Повторная модерация | 202 асинхронно | В testing контроллер сам выполняет engine синхронно, даже при Redis. PATCH и generation действительно dispatch jobs в отдельную Redis очередь; explicit verify не выдаётся за Redis job. |
| Предупреждения P1 | Поля нет в TeacherSignoffRequest | Реальный controller требует root `warnings_acknowledged: true` (или вложенный альтернативный флаг). UI имеет отдельный неотмеченный checkbox и отправляет root flag через локальный override. |
| История | GET по номеру, list отсутствует | Номер вводится явно; нет выдуманного списка с авторами/датами. Исторические версии только для чтения. |
| Fingerprint и допуск | Требуется запрет устаревшего fingerprint | Ни GET Scenario, ни GET Revision/Verification не возвращает актуальность provenance_fingerprint или действительность signoff. UI не может достоверно вычислить это сам. Перед допуском требует явную повторную модерацию в текущем сеансе и свежие GET; сервер повторно проверяет fingerprint. Race с отзывом evidence между проверкой и POST может быть обнаружен только сервером. 422 MODERATION_REVERIFICATION_REQUIRED сбрасывает готовность. Полная предварительная блокировка без POST требует отдельного read-contract backend. |
| Старый sign-off | status completed / is_confirmed | GET может продолжать возвращать completed и старую запись после отзыва evidence. UI обозначает запись как историческую; отдельный текущий успех показывается только после принятого POST и перечитывания. Это подтверждение на момент отправки, не бессрочная гарантия. |

Операции мутаций не повторяются автоматически при неизвестном результате. Консервативный guard 60 секунд ограничивает цепочку preflight / mutation / readback; при неопределённом ответе выполняется только GET-сверка, с локальным сравнением. Черновик хранится в памяти вкладки; перезагрузка/уход его удаляет после предупреждения. Не сохраняются содержимое сценария, токены или cookies в localStorage.
