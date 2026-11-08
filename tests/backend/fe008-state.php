<?php
declare(strict_types=1);
require '/var/www/html/vendor/autoload.php';
$app=require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;
$db=DB::connection()->getDatabaseName(); $role=DB::selectOne('select current_user as name')->name;
if(!app()->environment('testing')||$db!=='school_events_test'||$role!=='school_test_user') throw new RuntimeException('Test database only');
$ids=[getenv('FE008_SCHOOL_A'),getenv('FE008_SCHOOL_B')];
foreach($ids as $id) if(!is_string($id)||!preg_match('/^[a-f0-9-]{36}$/',$id)) throw new RuntimeException('Invalid school');
if(App\Models\School::whereIn('id',$ids)->where('name','like','FE008 %')->count()!==2) throw new RuntimeException('Foreign fixtures');
$action=getenv('FE008_ACTION')?:'inspect';
$revisions=App\Models\ScenarioRevision::whereHas('scenario',fn($q)=>$q->whereIn('school_id',$ids))->get();
if(in_array($action,['detach','attach'],true)) {
 $source=App\Models\EventSource::findOrFail(getenv('FE008_SOURCE'));
 if(!str_contains($source->title,'FE008')||!str_contains($source->title,'fixture')) throw new RuntimeException('Foreign source');
 App\Models\CulturalClaimSource::where('event_source_id',$source->id)->update(['is_detached'=>$action==='detach']);
}
// Temporary legacy/stale fixtures in the isolated test DB only. Restore from live provenance;
// bypass immutable model hooks solely to simulate pre-migration records, never in application code.
if(preg_match('/^(job|signoff|moderation)-(null|stale|restore)$/',$action,$m)) {
 foreach($revisions as $revision) {
  $fp=$m[2]==='null'?null:($m[2]==='stale'?str_repeat('0',64):app(App\Services\ProvenanceVerificationService::class)->computeRevisionProvenanceFingerprint($revision));
  $table=['job'=>'export_jobs','signoff'=>'teacher_signoffs','moderation'=>'revision_moderation_states'][$m[1]];
  DB::table($table)->where('revision_id',$revision->id)->update(['provenance_fingerprint'=>$fp]);
 }
}
$jobs=App\Models\ExportJob::with('artifact')->whereIn('revision_id',$revisions->pluck('id'))->get();
echo json_encode(['database'=>$db,'role'=>$role,'action'=>$action,'queueConnection'=>config('queue.default'),'queueName'=>config('queue.connections.redis.queue'),'redisDatabase'=>config('database.redis.default.database'),'jobs'=>$jobs->map(fn($j)=>['id'=>$j->id,'revision_id'=>$j->revision_id,'format'=>$j->format,'status'=>$j->status,'provenance_fingerprint'=>$j->provenance_fingerprint,'artifact'=>$j->artifact?->only(['id','mime_type','file_size_bytes','sha256_hash'])])->values()],JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE);
