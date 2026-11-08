"""Build traceable case index. Content notes are separately reviewed, never auto-approved."""
from pathlib import Path
import json
from datetime import datetime
root=Path(__file__).resolve().parents[1]
out=root/'docs/llm001-1/final-v152'
read=lambda name:json.loads((out/name).read_text(encoding='utf-8-sig'))
live=read('live-http.json')
samples=read('generated-samples-before-revoke.json')['samples']
db=read('postgres-live-before-revoke.json')
notes=read('content-notes.json')
gateway=[json.loads(line) for line in (out/'gateway-http.jsonl').read_text().splitlines()]
starts=[json.loads(line) for line in (out/'gateway-requests.jsonl').read_text().splitlines()]
stamp=lambda value:int(datetime.fromisoformat(value.replace('Z','+00:00')).timestamp())
cases=[]
for entry in live['scenarios']:
    sample=next(s for s in samples if s['generation_run_id']==entry['runId'])
    cases.append({'case':entry['scale'],'status':entry['result']['status'],'generation_run_id':entry['runId'],
                  'scenario_id':entry['result'].get('scenario_id'),'runs':[sample]})
comparisons=list(live['comparisons'])
if not any(c['type']=='cultural_context' for c in comparisons):
    comparisons.append(next(c for c in reversed(live['failedAttempts']) if c.get('type')=='cultural_context'))
for entry in comparisons:
    comparison=next(c for c in db['comparisons'] if c['id']==entry['id'])
    ids=comparison['differences_summary']['generation_run_ids']
    cases.append({'case':entry['type'],'status':entry['result']['status'],'comparison_id':entry['id'],
                  'runs':[next(s for s in samples if s['generation_run_id']==ids[v]) for v in ('A','B') if v in ids]})
(out/'quality-reviews').mkdir(exist_ok=True)
index=[]
def total(rows,key):
    return None if any(s[key] is None for s in rows) else sum(s[key] for s in rows)
for case in cases:
    rows=case.pop('runs')
    selected=[r for r in db['generationRuns'] if r['id'] in [s['generation_run_id'] for s in rows]]
    first=min(stamp(r['created_at']) for r in selected)
    last=max(stamp(r['completed_at']) for r in selected)
    observed=[g for g in gateway if first<=stamp(g['time'])<=last]
    sent=[g for g in starts if first<=stamp(g['time'])<=last]
    metering_complete=len(observed)==len(sent) and all(g.get('usage') is not None for g in observed)
    row={**case,'prompt_version':'school-methodist-1.5.2','model':'GigaChat-2-Max',
         'generation_run_ids':[s['generation_run_id'] for s in rows],
         'latency_ms':total(rows,'latency_ms'),
         'prompt_tokens':total(rows,'prompt_tokens'),
         'completion_tokens':total(rows,'completion_tokens'),
         'metering_complete':metering_complete,
         'metering_note':'Gateway-reported successful usage is preserved separately; absent failed-attempt usage is unknown, never zero. Window attribution uses scoped sequential worker timestamps.',
         'content_acceptance':'requires_independent_expert_review','teacher_signoff':'not_performed',
         'notes':notes[case['case']]}
    row['known_recorded_prompt_tokens']=row['prompt_tokens']
    row['known_recorded_completion_tokens']=row['completion_tokens']
    if not metering_complete:
        row['prompt_tokens']=None
        row['completion_tokens']=None
    index.append(row)
    text=f"# Quality review — {case['case']}\n\n"
    text+="Статус: PENDING INDEPENDENT REVIEW. Оценка исполнителя по реальному JSON; независимая экспертиза и Teacher Sign-Off не выполнялись.\n\n"
    text+=f"GigaChat-2-Max; school-methodist-1.5.2. Технический результат: {case['status']}. Run IDs: {', '.join(row['generation_run_ids'])}.\n\n"
    for section,note in notes[case['case']].items():text+=f"## {section}\n\n{note}\n\n"
    text+="Raw JSON, оба промпта, исходный ответ/repair и usage/latency: generated-samples-before-revoke.json. Отозванное evidence: generated-samples.json и live-provenance-selection.json. Предыдущие failed attempts сохранены отдельно в final-v140/141/142/150/151, первичном live-http-primary-v152.json и исходном llm001-1.\n"
    (out/'quality-reviews'/f"{case['case']}.md").write_text(text,encoding='utf-8')
result={'status':'PENDING INDEPENDENT REVIEW','executed_cases':len(index),'acceptance_complete':live['completed'],
        'technical_cases_completed':sum(c['status']=='completed' for c in index),'expert_cases_approved':0,
        'teacher_signoffs_performed':0,'cases':index}
(out/'case-outcomes.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in result.items() if k!='cases'}))
