# FE010 KPI independent calculation

Run 9cf645fab2; generated isolated fixtures only. A has 20/20 effective audited responses.

| KPI | Expected | Actual HTTP | Match |
| --- | ---: | ---: | --- |
| median_relative_time_saving_percent | 60 | 60 | PASS |
| personalization_choice_percent | 70 | 70 | PASS |
| manual_edit_under_20_percent_ratio | 70 | 70 | PASS |
| cultural_context_usage_percent | 60 | 60 | PASS |
| average_cultural_usefulness_score | 4.5 | 4.5 | PASS |
| critical_cultural_errors_count | 0 | 0 | PASS |

20 planned inputs: 10*80% + 10*40% savings; 14/20 personalization; 14/20 <=20% edits; 12/20 cultural use; six 4 and six 5 ratings; 20 effective audited reviews with zero errors.

PostgreSQL confirms retained review versions 1/2/3 for the corrected response, with only version 3 effective. Synthetic fixture results do not establish real-world effectiveness.
