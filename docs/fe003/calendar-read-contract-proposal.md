# Минимальное предложение: даты календаря (не реализовано на backend)

Проблема FE-002 остаётся: list/detail отдают id/title/event_type/region_code/description без date_type, fixed_month/day и occurrences. По этим ответам невозможно разместить события по дням без выдумывания даты. Это предложение для согласования; Laravel и generated OpenAPI не изменялись.

Добавить к CalendarEventSummary и CalendarEventEnvelope.data следующие read-only поля (брать из уже существующих CalendarEvent/EventOccurrence):

```json
{
  "date_type": "fixed_annual",
  "fixed_month": 11,
  "fixed_day": 4,
  "occurrences": [
    {
      "id": "<existing-occurrence-uuid>",
      "academic_year": "2026-2027",
      "start_date": "2026-11-04",
      "end_date": "2026-11-04"
    }
  ]
}
```

Это иллюстрация схемы, не фактический HTTP-ответ. Тип date_type — enum `fixed_annual | floating_rule | single_occurrence` из действующего CreateCalendarEventRequest. fixed_month (1–12) и fixed_day (1–31 с проверкой календарной пары) nullable; для непостоянных дат оба null. occurrences — массив, возможно пустой, start_date — YYYY-MM-DD, end_date — nullable YYYY-MM-DD и не ранее start_date. Все поля readOnly; event visibility и X-School-Id остаются обязательными по текущим правилам.

При from/to возвращать occurrences, пересекающие включительный интервал, для уже выбранных и пагинированных событий (одна eager-load выборка, без N+1). Без from/to договориться об ограниченном учебном году в ответе; не возвращать неограниченную историю. В meta добавить описанный date window, если сервер ограничивает его по умолчанию. Пагинация остаётся по событиям; markers относятся к текущей странице, а не ко всему месяцу — это должно быть явно видно в UI.

При наличии конкретного occurrence использовать его как приоритетный; fixed_annual означает ежегодное правило и не подтверждает проведение регионального анонса в новом году. Для 29 февраля не создавать дату несуществующего дня. Если API должен возвращать все markers месяца независимо от пагинации событий, это отдельный агрегатный endpoint и отдельное согласование, не часть минимального расширения.

Обновить backend OpenAPI и контрактные тесты одновременно, затем перегенерировать frontend types и реализовать markers. До согласования frontend сохраняет честное предупреждение об отсутствии дат.
