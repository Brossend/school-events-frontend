import { describe, expect, it } from 'vitest'
import { calendarEventDates } from '../app/utils/calendar'
import { parsePilotReviewHistory, parsePilotParticipants } from '../app/utils/pilot'
const source = { date_type:'fixed_annual',fixed_month:12,fixed_day:31 }
const id='019a0000-0000-7000-8000-000000000001',responseId='019a0000-0000-7000-8000-000000000002'
const finding={id,pilot_response_id:responseId,expert_name:'Test expert',expert_audit_status:'audited',critical_cultural_errors:1,methodological_remarks:'Test finding',finding_version:2,is_effective:true,reviewed_at:'2026-10-30T00:00:00Z'}
describe('FE012 real date fields',()=>{
 it('places annual dates in the requested calendar year',()=>expect(calendarEventDates(source,'2026-12-01','2026-12-31')).toEqual(['2026-12-31']))
 it('crosses calendar years without using the event title',()=>expect(calendarEventDates(source,'2026-12-20','2027-01-10')).toEqual(['2026-12-31']))
 it('does not manufacture a leap day in a non-leap year',()=>{const event={date_type:'fixed_annual',fixed_month:2,fixed_day:29};expect(calendarEventDates(event,'2027-02-01','2027-02-28')).toEqual([]);expect(calendarEventDates(event,'2028-02-01','2028-02-29')).toEqual(['2028-02-29'])})
 it('clips a multi-day occurrence across the month/year boundary',()=>expect(calendarEventDates({date_type:'single_occurrence',occurrences:[{id,academic_year:'2026-2027',start_date:'2026-12-30',end_date:'2027-01-02',source_reference:'Test'}]},'2027-01-01','2027-01-31')).toEqual(['2027-01-01','2027-01-02']))
 it('uses the explicit occurrence instead of the nominal annual day for that academic year',()=>expect(calendarEventDates({...source,occurrences:[{id,academic_year:'2026-2027',start_date:'2026-12-29',end_date:null,source_reference:null}]},'2026-12-01','2026-12-31')).toEqual(['2026-12-29']))
 it('does not infer a date when the API has none',()=>expect(calendarEventDates({},'2026-11-01','2026-11-30')).toEqual([]))
 it('rejects malformed occurrence dates and inverted bounds',()=>{expect(calendarEventDates({occurrences:[{id,academic_year:'2026-2027',start_date:'2026-02-31',end_date:null,source_reference:null}]},'2026-02-01','2026-03-02')).toEqual([]);expect(calendarEventDates(source,'2027-01-01','2026-12-01')).toEqual([])})
 it('deduplicates overlapping concrete occurrences',()=>expect(calendarEventDates({occurrences:[{id,academic_year:'2026-2027',start_date:'2026-12-31',end_date:null,source_reference:null},{id:'other',academic_year:'2026-2027',start_date:'2026-12-31',end_date:'2027-01-01',source_reference:null}]},'2026-12-31','2027-01-01')).toEqual(['2026-12-31','2027-01-01']))
})
describe('FE012 reloadable pilot expert review',()=>{
 it('returns the effective finding and historical versions from server GET',()=>{const history=parsePilotReviewHistory({data:{pilot_response_id:responseId,effective_review:finding,versions:[finding,{...finding,id:'019a0000-0000-7000-8000-000000000003',finding_version:1,is_effective:false}]}});expect(history.effective_review?.critical_cultural_errors).toBe(1);expect(history.versions).toHaveLength(2)})
 it('keeps an absent expert finding distinct from zero errors',()=>expect(parsePilotReviewHistory({data:{pilot_response_id:responseId,effective_review:null,versions:[]}}).effective_review).toBeNull())
 it('rejects history bound to another response',()=>expect(()=>parsePilotReviewHistory({data:{pilot_response_id:id,effective_review:finding,versions:[finding]}})).toThrow())
 it('rejects duplicate versions and inconsistent effective flags',()=>{expect(()=>parsePilotReviewHistory({data:{pilot_response_id:responseId,effective_review:finding,versions:[finding,finding]}})).toThrow();expect(()=>parsePilotReviewHistory({data:{pilot_response_id:responseId,effective_review:null,versions:[finding]}})).toThrow()})
 it('parses an administrative participant response ID without exposing invitation secrets',()=>{const participant={id,anonymous_code:'FE012',subject_area:'Test',teaching_experience_years:1,is_submitted:true,is_synthetic:true,expires_at:'2026-11-30',is_expired:false,is_revoked:false,used_at:'2026-10-30',has_response:true,response_id:responseId,created_at:'2026-10-30',invite_token:'must not survive'};const result=parsePilotParticipants({data:[participant]})[0]!;expect(result.response_id).toBe(responseId);expect(result).not.toHaveProperty('invite_token')})
})
