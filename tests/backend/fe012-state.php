<?php
declare(strict_types=1);
require '/var/www/html/vendor/autoload.php';$app=require '/var/www/html/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;
$db=DB::selectOne('select current_database() as db,current_user as role');
if(!app()->environment('testing')||$db->db!=='school_events_test'||$db->role!=='school_test_user')throw new RuntimeException('FE012 test DB required');
$run=getenv('FE012_RUN');if(!preg_match('/^[a-f0-9]{10}$/',(string)$run))throw new RuntimeException('FE012 run required');
$schools=App\Models\School::where('name','like','FE012 '.$run.' %')->get();if($schools->count()!==3)throw new RuntimeException('Owned schools required');
$events=App\Models\CalendarEvent::where('title','like','FE012 '.$run.' %')->pluck('id');
$sources=App\Models\EventSource::whereIn('calendar_event_id',$events)->pluck('id');
$claims=App\Models\CulturalClaim::whereIn('calendar_event_id',$events)->pluck('id');
$scenarioIds=App\Models\Scenario::whereIn('school_id',$schools->pluck('id'))->pluck('id');
$revisionIds=DB::table('scenario_revisions')->whereIn('scenario_id',$scenarioIds)->pluck('id');
$tables=['schools'=>$schools->map(fn($s)=>$s->toArray()),'event_sources'=>DB::table('event_sources')->whereIn('id',$sources)->orderBy('id')->get(),'source_reviews'=>DB::table('source_reviews')->whereIn('event_source_id',$sources)->orderBy('reviewed_at')->orderBy('id')->get(),'cultural_claim_sources'=>DB::table('cultural_claim_sources')->whereIn('cultural_claim_id',$claims)->orderBy('id')->get(),'cultural_claim_evidence_audit_events'=>DB::table('cultural_claim_evidence_audit_events')->whereIn('cultural_claim_id',$claims)->orderBy('created_at')->orderBy('id')->get(),'scenarios'=>DB::table('scenarios')->whereIn('id',$scenarioIds)->get(),'export_jobs'=>DB::table('export_jobs')->whereIn('revision_id',$revisionIds)->get()];
$tables['pilot_participants']=DB::table('pilot_participants')->whereIn('school_id',$schools->pluck('id'))->select(['id','school_id','anonymous_code','is_submitted','is_synthetic','used_at','revoked_at'])->get();
$tables['pilot_responses']=DB::table('pilot_responses')->whereIn('participant_id',collect($tables['pilot_participants'])->pluck('id'))->get();
$tables['pilot_review_findings']=DB::table('pilot_review_findings')->whereIn('pilot_response_id',collect($tables['pilot_responses'])->pluck('id'))->get();
echo json_encode(['database'=>$db->db,'role'=>$db->role,'environment'=>app()->environment(),'queue'=>config('queue.default'),'runId'=>$run,'sqlScope'=>'Only schools with exact FE012 run prefix; events and dependent sources/claims/audits/scenarios/exports belonging to this run','tables'=>$tables],JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE);
