# FE-008 — Document Export, Download & Provenance-Safe History

Дата: 2026-10-27. **Статус: PENDING INDEPENDENT REVIEW.** FE-009 не начат. Backend source и Figma не изменялись.

## Реализация

Экспорт и история встроены одним диалогом в просмотр и редактор сценария. Поддержаны PDF, DOCX, PPTX, Print Pack PDF с объяснением назначения. Несохранённые изменения редактора блокируют создание. Перед POST перечитываются сценарий, модерация и история; frontend проверяет очевидные ограничения текущей ревизии/P0/sign-off, окончательный допуск оставлен Laravel Provenance Gate. P1 показан отдельно.

UUID Idempotency-Key и минимальная квитанция изолированы по пользователю, школе, сценарию, ревизии и формату. Двойной submit блокируется. После потери ответа нет автоматического POST/нового ключа: история перечитывается, затем пользователь может явно повторить прежний ключ. Для известного терминального задания предусмотрено отдельное создание нового файла. Консервативное окно восстановления — 23 часа при серверном TTL 24 часа; позднее требуется сверка с администратором.

Queued, processing, ready, failed отображаются отдельно. Polling последовательный, базовый интервал 2 секунды, backoff до 30 секунд, остановка после 6 ошибок или 5 минут наблюдения. Есть ручное обновление, пауза скрытой вкладки, AbortSignal и защита от поздних ответов при смене контекста. Ошибка сети не превращается в failed.

История относится к конкретной ревизии и показывает формат, дату, статус, имя, размер и завершение. Кнопки учитывают свежий is_downloadable. GET download повторно проходит серверный допуск. Защищённый бинарный transport использует cookies, X-School-Id, AbortSignal, проверяет MIME, сигнатуру и SHA256 из истории; сохраняет через Blob URL с освобождением. Документы в localStorage не сохраняются. Произвольный download_url не открывается.

## Контракт и дизайн

[API contract](fe008/api-contract.md) фиксирует реальные поля и расхождения OpenAPI: POST 202 не имеет полной схемы; GET job не содержит format/revision_id/is_downloadable. Реальные JSON сохранены в [HTTP evidence](fe008/evidence/http-exports.json). Типизация исправлена локальным override без правки backend OpenAPI.

[Figma inventory](fe008/figma-node-inventory.md): 26 high-fidelity contexts, адаптивные варианты выбора/ожидания/готовности/ошибки, DOCX selected, четыре print и пять slide references, prototype transitions. UI использует существующие Inter/UI-kit и точный download SVG. Четыре карточки расширяют двухформатный макет по заданию; composition toggles без серверного контракта не добавлены. История использует UI-kit в том же диалоге. Серверные шаблоны документов не заменяются фронтендом.

## Проверки

| Проверка | Результат |
|---|---|
| Typecheck | PASS |
| ESLint | PASS |
| Vitest | 289/289: прежние 236 + 53 FE-008 |
| Реальный HTTP E2E | PASS, 77 запросов, localhost:8001 → app-test → school_events_test |
| Production build | PASS, Nuxt 4.6.2 / Nitro 2.13.5, 55.3 s; Nitro smoke /login → 200 |

Логи и коды возврата: [final-checks.json](fe008/evidence/final-checks.json). Unit tests используют маркированные synthetic fixtures и отдельно проверяют transport; реальные скачанные документы подтверждаются HTTP E2E.

E2E создал ScenarioRequest, выполнил генерацию MockLlmProvider и модерацию отдельным Redis worker (DB1, очередь fe008_03d4500879), подтвердил ревизию педагогом и создал четыре ExportJob. Проверены одинаковый ID при replay и восстановление прежнего ключа после намеренно проигнорированного принятого ответа 202. Это моделирование потерянного ответа; реальный сетевой разрыв отдельно покрыт controller-тестами.

Автор и school_admin скачивают документы; другой педагог и другая школа получают 403, произвольный отсутствующий UUID — 404, после logout — 401. Историческая ревизия/её файл получают 409, новая ревизия без sign-off — 403. Unit tests дополнительно покрывают 5xx, сетевую ошибку, отмену/смену школы при загрузке, MIME/HTML/signature/checksum rejection и освобождение Blob URL.

В [denials HTTP evidence](fe008/evidence/http-exports.json) сохранены семь реальных отказов GET download 403: revoked evidence; stale/NULL job fingerprint; stale/NULL signoff fingerprint; stale/NULL moderation fingerprint. После отзыва ранее ready артефактов история сообщает is_downloadable=false; новый экспорт также запрещён. Для legacy cases тестовый helper временно изменяет только собственные FE008 fixtures в изолированной БД и восстанавливает их. Это имитация записей до миграции, не функция приложения и не изменение immutable sign-off через API.

## Скачанные документы

Четыре файла — реальные ответы Laravel, скачанные в разрешённом состоянии v1; затем v1 стала исторической, и повторный доступ запрещён. Это синтетические reviewer fixtures, не согласованные материалы для проведения.

| Файл | MIME | Размер | Проверка |
|---|---|---:|---|
| [PDF](fe008/evidence/documents/fe008-pdf.pdf) | application/pdf | 1 298 401 | %PDF, 4 страницы, текст FE008 |
| [DOCX](fe008/evidence/documents/fe008-docx.docx) | application/vnd.openxmlformats-officedocument.wordprocessingml.document | 12 132 | ZIP CRC, Content_Types, word/document.xml, русский текст |
| [PPTX](fe008/evidence/documents/fe008-pptx.pptx) | application/vnd.openxmlformats-officedocument.presentationml.presentation | 22 382 | ZIP CRC, 5 slides, 5 notesSlides, 16:9, XML text |
| [Print Pack](fe008/evidence/documents/fe008-print_pack_pdf.pdf) | application/pdf | 1 682 999 | %PDF, 3 страницы: памятка, карточки, маршрутный лист |

SHA256 каждого файла и извлечённое содержимое: [document-validation.json](fe008/evidence/document-validation.json). Контрольные суммы совпали с metadata backend. PDF отрисованы Poppler; просмотрены все семь страниц. DOCX/PPTX проверены структурно и по содержимому XML; открытие в Microsoft Office не заявляется.

## Визуальная проверка

[Скриншоты](fe008/screenshots/metadata.json): шесть состояний selection/waiting/ready/history/blocked/error × четыре размера. Fixture-скриншоты содержат явный баннер синтетических данных. Нет горизонтального переполнения в измеренных viewport. Desktop — 1440 CSS px, mobile — 390/360. Из-за DPR 0.84 tablet override даёт 767 CSS px вместо 768; это явно зафиксированное ограничение проверки. Снимки браузера могут содержать внешнюю полосу capture padding.

Live-скриншоты и журнал браузерных скачиваний дополняют компонентные проверки. Через браузер сохранены все четыре формата v2; размеры и SHA256 в browser-downloads.json. После отзыва evidence серверная причина показана дословно, скачивание ранее ready файлов отключено; browser-blocked-ui.json содержит наблюдение. На реальной странице 360 px обнаружено переполнение строки действий на 9 px; добавлен локальный перенос кнопок scenario-reader, повторно измерено отсутствие переполнения. На первом запуске PDF браузер успел получить accepted ID, затем истёк локальный таймаут перечитывания. Квитанция сохранилась; повторного POST автоматически не было. Избыточный GET истории удалён, независимые preflight GET распараллелены; polling статуса остаётся последовательным. В testing backend возвращает ready синхронно в HTTP 202 даже при redis connection; production queued/processing проверены unit/controller tests и маркированными визуальными fixtures. Полный production export worker через HTTP в этой среде не проверен.

## Окружение и ограничения

Начальный реальный POST выявил root-owned testing private storage: FPM не мог создать каталог/сохранить файл (500). Исправлен только владелец трёх каталогов testing/private/exports на www-data; backend source/config не менялись, permissions не расширялись. Первый отказ сохранён в http-storage-permission-failure.json. Рабочая БД и основная Redis очередь не использовались для мутаций.

CORS не раскрывает Content-Disposition и X-Checksum-Sha256: браузер использует безопасное fallback-имя и SHA из истории. Provenance freshness не полностью раскрывается GET, поэтому доступ не обещается только по историческому sign-off. Нет выбора состава документа, slides_pdf, клиентских Word/PPT/PDF, реального внешнего LLM или исправления семейного MockLlmProvider. Поддерживаемый клиентом размер — до 128 МиБ. Недоступное/повреждённое хранилище квитанции блокирует POST, сохраняя возможность читать историю.

Backend PDF renderer переносит продолжение подтверждения на почти пустую четвёртую страницу; это ограничение серверной пагинации. PPTX формирует пять канонических слайдов, хотя scenario payload содержит два описания слайдов; это существующее поведение backend. Оформление документов не менялось.

После проверок тестовый app-test возвращён к base compose queue=sync; подтверждение — restored-test-config.json. Frontend dev возвращается к обычному API 8000. ZIP исключает node_modules, .nuxt, .output, .git, .idea, private .env, ключи, cookies, токены и старые ZIP; .env.example содержит только пример. Manifest/CRC/SHA256 и скан известных секретов выполняются release verifier.

## План FE-009

FE-009 не реализован. После независимой приёмки FE-008: получить отдельное ТЗ и дизайн, определить разрешённый API scope, согласовать устранение неполноты OpenAPI/CORS на стороне backend и необходимость отдельного production-like queue acceptance. Не добавлять новые бизнес-функции до постановки задачи.
