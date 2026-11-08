<?php
declare(strict_types=1);
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (app()->environment() !== 'testing' || Illuminate\Support\Facades\DB::connection()->getDatabaseName() !== 'school_events_test') throw new RuntimeException('Non-test DB refused');
$ids = [getenv('FE004_SCHOOL_A'), getenv('FE004_SCHOOL_B')];
foreach ($ids as $id) if (!is_string($id) || !preg_match('/^[a-f0-9-]{36}$/', $id)) throw new RuntimeException('Invalid fixture school');
$traditions = App\Models\SchoolTradition::with('versions')->whereIn('school_id', $ids)->get();
echo json_encode(['database' => 'school_events_test', 'traditions' => $traditions->map(fn ($t) => [
    'id' => $t->id, 'school_id' => $t->school_id, 'title' => $t->title, 'is_archived' => $t->is_archived,
    'versions' => $t->versions->map(fn ($v) => ['id' => $v->id, 'academic_year' => $v->academic_year, 'notes' => $v->notes, 'parameters_snapshot' => $v->parameters_snapshot])->values(),
])->values()], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
