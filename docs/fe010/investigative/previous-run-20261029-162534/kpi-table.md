# FE010 KPI independent calculation

Generated synthetic fixtures in school_events_test only. N=20; completed effective audits=20/20.

| Server KPI field | Independently expected | Actual HTTP | Match |
| --- | ---: | ---: | --- |
| median_relative_time_saving_percent | 60 | 60 | YES |
| personalization_choice_percent | 70 | 70 | YES |
| manual_edit_under_20_percent_ratio | 70 | 70 | YES |
| cultural_context_usage_percent | 60 | 60 | YES |
| average_cultural_usefulness_score | 4.5 | 4.5 | YES |
| critical_cultural_errors_count | 0 | 0 | YES |

The median uses the middle two sorted preparation-time reductions (40% and 80%). Personalization and low-edit proportions each use 14/20; cultural usage uses 12/20; usefulness uses twelve non-null ratings (six 4, six 5). Critical error sum uses only current effective audited versions. The previous critical-error version is retained and excluded after a newer zero-error review.

This is an API calculation check, not evidence that synthetic teacher preferences establish effectiveness.
