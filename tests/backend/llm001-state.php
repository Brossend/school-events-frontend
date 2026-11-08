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
$encoded=json_encode($data,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT);
echo str_replace((string)config('llm.api_key'),'[REDACTED]',$encoded);
