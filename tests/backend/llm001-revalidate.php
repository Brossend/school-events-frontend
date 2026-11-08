<?php
require '/var/www/html/vendor/autoload.php';
$app=require '/var/www/html/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$db=Illuminate\Support\Facades\DB::selectOne('select current_database() as db,current_user as role');$run=getenv('LLM001_RUN');
if(!app()->environment('testing')||$db->db!=='school_events_test'||$db->role!=='school_test_user'||!preg_match('/^[a-f0-9]{10}$/',(string)$run))throw new RuntimeException('Isolated state scope required');
$schools=App\Models\School::where('name','like','LLM001 '.$run.' %')->pluck('id');
$requests=App\Models\ScenarioRequest::whereIn('school_id',$schools)->get();
$runs=App\Models\GenerationRun::whereIn('scenario_request_id',$requests->pluck('id'))->get();
$scenarios=App\Models\Scenario::whereIn('school_id',$schools)->get();
$data=['database'=>$db->db,'role'=>$db->role,'provider'=>config('llm.provider'),'model'=>config('llm.model'),'secretPresent'=>!empty(config('llm.api_key')),
 'queue'=>config('queue.default'),'runId'=>$run,'requests'=>$requests,'generationRuns'=>$runs,'scenarios'=>$scenarios,
 'revisions'=>App\Models\ScenarioRevision::whereIn('scenario_id',$scenarios->pluck('id'))->get(),
 'comparisons'=>App\Models\ScenarioComparison::whereIn('school_id',$schools)->get()];

$result=[];
foreach ($runs->where('status','failed') as $failed) { if ($failed->sanitized_response) { try { app(App\Services\Llm\ScenarioQualityValidator::class)->validate($failed->sanitized_response); $result[]=['failedRun'=>$failed->id,'newQualityGate'=>'PASS (historical run remains failed)']; } catch (Throwable $e) { $result[]=['failedRun'=>$failed->id,'newQualityGate'=>'FAIL','reason'=>$e->getMessage()]; } } }
foreach ($requests->whereNull('calendar_event_id') as $request) {
 $run=$runs->where('scenario_request_id',$request->id)->where('status','completed')->first();
 if(!$run)continue;
 $payload=$run->sanitized_response;
 app(App\Services\Llm\GenerationOutputValidator::class)->validate($payload);
 app(App\Services\Llm\ScenarioSemanticValidator::class)->validate($payload,$request->context_snapshot);
 app(App\Services\Llm\RequestedScenarioValidator::class)->validate($payload,$request,'personalized');
 app(App\Services\Llm\ScenarioQualityValidator::class)->validate($payload);
 $mock=app(App\Services\Llm\MockLlmProvider::class)->generate($request);
 $result[]=['scale'=>$request->scale,'runId'=>$run->id,'liveRevalidated'=>true,'live'=>$payload,'mockFixture'=>$mock];
}
echo json_encode(['source'=>'saved live LiteLLM output and local mock on same ScenarioRequest; no HTTP','results'=>$result],JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT);
