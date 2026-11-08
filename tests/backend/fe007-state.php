<?php
declare(strict_types=1);
require '/var/www/html/vendor/autoload.php';
$app=require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$db=Illuminate\Support\Facades\DB::connection()->getDatabaseName();
$role=Illuminate\Support\Facades\DB::selectOne('select current_user as name')->name;
if (!app()->environment('testing') || $db!=='school_events_test' || $role!=='school_test_user') throw new RuntimeException('Non-test database refused');
$ids=[getenv('FE007_SCHOOL_A'),getenv('FE007_SCHOOL_B')];
foreach($ids as $id) if(!is_string($id)||!preg_match('/^[a-f0-9-]{36}$/',$id)) throw new RuntimeException('Invalid fixture school');
if (App\Models\School::whereIn('id',$ids)->where('name','like','FE007 %')->count()!==2) throw new RuntimeException('Foreign fixtures refused');
$action=getenv('FE007_ACTION')?:'inspect';
if(in_array($action,['detach','attach'],true)) {
 $source=App\Models\EventSource::findOrFail(getenv('FE007_SOURCE'));
 if(!str_contains($source->title,'FE007')||!str_contains($source->title,'fixture')) throw new RuntimeException('Non-fixture evidence refused');
 App\Models\CulturalClaimSource::where('event_source_id',$source->id)->update(['is_detached'=>$action==='detach']);
}
$scenarios=App\Models\Scenario::with(['revisions.moderationState','revisions.teacherSignoffs'])->whereIn('school_id',$ids)->get();
$sql=Illuminate\Support\Facades\DB::select('select r.id, r.scenario_id, r.version_number, md5(r.content_payload::text) as payload_md5, r.created_at from scenario_revisions r join scenarios s on s.id=r.scenario_id where s.school_id in (?, ?) order by r.scenario_id, r.version_number',$ids);
echo json_encode(['database'=>$db,'role'=>$role,'action'=>$action,'queueConnection'=>config('queue.default'),'queueName'=>config('queue.connections.redis.queue'),'redisDatabase'=>config('database.redis.default.database'),'sqlRows' =>$sql,'scenarios'=>$scenarios->map(fn($s)=>['id'=>$s->id,'current_revision_id'=>$s->current_revision_id,'lock'=>$s->optimistic_lock_version,'revisions'=>$s->revisions->sortBy('version_number')->map(fn($r)=>['id'=>$r->id,'version'=>$r->version_number,'contentSha256'=>hash('sha256',json_encode($r->content_payload,JSON_UNESCAPED_UNICODE)),'content_payload'=>$r->content_payload,'moderation'=>$r->moderationState?->status,'signoffs'=>$r->teacherSignoffs->count()])->values()])->values()],JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE);
