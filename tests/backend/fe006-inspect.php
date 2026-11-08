<?php
declare(strict_types=1);
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$database = Illuminate\Support\Facades\DB::connection()->getDatabaseName();
$role = Illuminate\Support\Facades\DB::selectOne('select current_user as name')->name;
if (app()->environment() !== 'testing' || $database !== 'school_events_test' || $role !== 'school_test_user') throw new RuntimeException('Non-test DB refused');
$ids = [getenv('FE006_SCHOOL_A'), getenv('FE006_SCHOOL_B')];
foreach ($ids as $id) if (!is_string($id) || !preg_match('/^[a-f0-9-]{36}$/', $id)) throw new RuntimeException('Invalid fixture school');
$requests = App\Models\ScenarioRequest::whereIn('school_id', $ids)->pluck('id');
$runs = App\Models\GenerationRun::whereIn('scenario_request_id', $requests)->get();
$scenarios = App\Models\Scenario::with('revisions')->whereIn('school_id', $ids)->get();
echo json_encode(['database' => $database, 'role' => $role, 'queueConnection' => config('queue.default'), 'queueName' => config('queue.connections.redis.queue'), 'redisDatabase' => config('database.redis.default.database'), 'redisPrefix' => config('database.redis.options.prefix'), 'runs' => $runs->map(fn ($r) => ['id' => $r->id, 'scenario_request_id' => $r->scenario_request_id, 'status' => $r->status, 'provider_name' => $r->provider_name, 'completed_at' => $r->completed_at, 'error_code' => $r->error_code])->values(), 'scenarios' => $scenarios->map(fn ($s) => ['id' => $s->id, 'school_id' => $s->school_id, 'scenario_request_id' => $s->scenario_request_id, 'current_revision_id' => $s->current_revision_id, 'revisions' => $s->revisions->map(fn ($r) => ['id' => $r->id, 'version_number' => $r->version_number, 'source_generation_run_id' => $r->source_generation_run_id, 'content_payload' => $r->content_payload])->values()])->values()], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
