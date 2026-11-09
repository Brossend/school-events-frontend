# Школьные события — frontend

Рабочая платформа: <https://school-events.ru/>. Nuxt 4 / Vue 3 / TypeScript / Pinia: календарь, пятишаговый конструктор, сценарии и ревизии, модерация, тестовый Sign-Off, экспорт PDF/DOCX/PPTX, традиции, A/B и интерфейс пилотных показателей. Auth-страницы используют SSR; кабинет сохраняет клиентский рендеринг.

**DEPLOY-001 CLOSED — PUBLIC HTTPS VERIFIED.** Production frontend `9aee989fb0cb040bb4855d7cfc11a612fecae396`, backend `ea1a51b634a0e5b3c4acea7360e3d19ff2256b73`. Последующие документационные коммиты не меняют deployed images.

## Сдача и доказательства

Комплект передачи хранится в [backend docs](https://gitlab.com/Brossend2335/school-events-backend/-/tree/main/docs): [демонстрация](https://gitlab.com/Brossend2335/school-events-backend/-/blob/main/docs/HANDOFF-001-demo-guide.md), [архитектура](https://gitlab.com/Brossend2335/school-events-backend/-/blob/main/docs/HANDOFF-001-architecture.md), [ограничения](https://gitlab.com/Brossend2335/school-events-backend/-/blob/main/docs/HANDOFF-001-limitations.md), [итог](https://gitlab.com/Brossend2335/school-events-backend/-/blob/main/docs/HANDOFF-001-final-report.md), [публичная приёмка](https://gitlab.com/Brossend2335/school-events-backend/-/blob/main/docs/DEPLOY-001.1-final-acceptance.md).

Production использует MockProvider. Реальная LiteLLM проверена отдельно; педагогическая экспертиза и полноценный пилот с реальными участниками не проводились. Демо имеет содержательные замечания Quality Gate. Тестовый Sign-Off не означает методическое одобрение.

## Локальный запуск

Нужен Node.js 24.15+ (проверено 24.22.1, `.nvmrc`) и отдельно запущенный backend `http://localhost:8000`.

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Откройте `http://localhost:3000`. `NUXT_PUBLIC_API_ORIGIN` задаёт адрес API. Для локального входа используйте один hostname localhost, настройте CORS/Sanctum на backend и существующий синтетический аккаунт. Production credentials в локальные примеры не переносить. [Подробный запуск и изоляция тестов](docs/FE-012-launch.md).

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

API types обновляются `npm run api:generate` из `../school/docs/openapi.yaml`. Live integration tests требуют отдельной тестовой БД и не предназначены для production.

## Репозитории и CI/CD

[GitLab frontend](https://gitlab.com/Brossend2335/school-events-frontend) и [backend](https://gitlab.com/Brossend2335/school-events-backend) — основные; [GitHub frontend](https://github.com/Brossend/school-events-frontend) и [backend](https://github.com/Brossend/school-events-backend) — закрытые зеркала main. [Frontend pipeline 3041847464](https://gitlab.com/Brossend2335/school-events-frontend/-/pipelines/3041847464) прошёл все 7 jobs. Deployment выполняется backend pipeline с закреплённым frontend SHA; GitHub Actions не используется.

Восстановление пароля, длительный вход и вход встроенной кнопкой деморежима не реализованы сервером; используйте обычную форму с приватно выданным аккаунтом педагога. Исторические FE/LLM отчёты в docs отражают состояние соответствующих этапов; текущая техническая приёмка — DEPLOY-001.1.
