<?php
require '/var/www/html/vendor/autoload.php';
$app=require '/var/www/html/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$db=Illuminate\Support\Facades\DB::selectOne('select current_database() as db,current_user as role');$run=getenv('LLM001_RUN');
if(!app()->environment('testing')||$db->db!=='school_events_test'||$db->role!=='school_test_user'||!preg_match('/^[a-f0-9]{10}$/',(string)$run))throw new RuntimeException('Isolated state scope required');
$schools=App\Models\School::where('name','like','LLM001 '.$run.' %')->pluck('id');
$requests=App\Models\ScenarioRequest::whereIn('school_id',$schools)->get();
$runs=App\Models\GenerationRun::whereIn('scenario_request_id',$requests->pluck('id'))->get();
$scenarios=App\Models\Scenario::whereIn('school_id',$schools)->get();

if (config('queue.default') !== 'redis' || config('queue.connections.redis.queue') !== 'llm001-'.$run) throw new RuntimeException('Queue scope refused');
$comparisons=App\Models\ScenarioComparison::whereIn('school_id',$schools)->get();
if($runs->whereIn('status',['queued','running'])->count()||$comparisons->where('status','pending')->count()) throw new RuntimeException('Wait until terminal');
$mode=getenv('LLM001_ACTION');
if($mode==='dispatch') {
 foreach($runs as $item)App\Jobs\ExecuteGenerationRunJob::dispatch($item->id)->onQueue('llm001-'.$run);
 foreach($comparisons as $item)App\Jobs\GenerateComparisonJob::dispatch($item->id)->onQueue('llm001-'.$run);
}
$log=storage_path('app/llm001-'.$run.'/gateway-http.jsonl');
echo json_encode(['mode'=>$mode,'queue'=>'llm001-'.$run,'database'=>$db->db,'role'=>$db->role,'gatewayCalls'=>count(file($log,FILE_IGNORE_NEW_LINES)),
 'scenarios'=>$scenarios->count(),'revisions'=>App\Models\ScenarioRevision::whereIn('scenario_id',$scenarios->pluck('id'))->count(),
 'generationRuns'=>$runs->count(),'comparisons'=>$comparisons->count(),'statuses'=>$runs->countBy('status')],JSON_PRETTY_PRINT);
