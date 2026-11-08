# Зарегистрированные ограничения backend

## BE-MOCK-FAMILY-001 — RULE_MECHANISM_ACTIVITY_NOT_FOUND

Источник: реальный FE-006 HTTP/UI запуск с backend MockLlmProvider, family_community / class_hour / historical_memory, 90 минут. GenerationRun `01a1771c-c0bc-724c-be60-da0f7c69d12e` завершился failed / VALIDATION_FAILED: «Лаборатория анализа исторических источников» отсутствует в activities при ссылке из pedagogical_mechanism. Подробности — `../FE-006-review.md` и `../fe006/evidence/persisted-generation-final.json`.

FE-007 этот дефект не исправляет, не обходит semantic validator и не выдаёт неуспешный результат за готовый сценарий. Нужна отдельная backend-задача и согласование изменений Laravel.

## BE-READ-SIGNOFF-001 — GET не раскрывает актуальность допуска

После отзыва evidence исторический sign-off остаётся в GET, а status может оставаться completed. Endpoint предварительного Provenance Gate / актуальный fingerprint не предоставлен. Реальные отрицательные sign-off POST покрыты FE-007 E2E. UI сохраняет историческую запись отдельно и не утверждает бессрочную действительность; полная preflight-блокировка требует расширения read-contract. Backend не изменён.
