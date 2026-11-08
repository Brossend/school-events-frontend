<?php
declare(strict_types=1);
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$database = Illuminate\Support\Facades\DB::connection()->getDatabaseName();
$role = Illuminate\Support\Facades\DB::selectOne('select current_user as name')->name;
if (app()->environment() !== 'testing' || $database !== 'school_events_test' || $role !== 'school_test_user') throw new RuntimeException('Non-test DB refused');
$ids = [getenv('FE005_SCHOOL_A'), getenv('FE005_SCHOOL_B')];
foreach ($ids as $id) if (!is_string($id) || !preg_match('/^[a-f0-9-]{36}$/', $id)) throw new RuntimeException('Invalid fixture school');
$requests = App\Models\ScenarioRequest::whereIn('school_id', $ids)->orderBy('created_at')->get();
echo json_encode(['database' => $database, 'role' => $role, 'generationRuns' => App\Models\GenerationRun::count(), 'requests' => $requests->map(fn ($r) => ['id' => $r->id, 'school_id' => $r->school_id, 'user_id' => $r->user_id, 'calendar_event_id' => $r->calendar_event_id, 'tradition_version_id' => $r->tradition_version_id, 'custom_event_title' => $r->custom_event_title, 'context_snapshot_present' => !empty($r->context_snapshot), 'created_at' => $r->created_at])->values()], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
