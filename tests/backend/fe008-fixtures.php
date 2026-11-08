<?php
// Isolated HTTP fixtures only. Invoke via app-test, never app.
declare(strict_types=1);
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (app()->environment() !== 'testing' || Illuminate\Support\Facades\DB::connection()->getDatabaseName() !== 'school_events_test') {
    throw new RuntimeException('FE008 refuses non-test database');
}
$databaseUser = Illuminate\Support\Facades\DB::selectOne('select current_user as name')->name;
if ($databaseUser !== 'school_test_user') throw new RuntimeException('FE008 requires isolated DB role');
$runId = bin2hex(random_bytes(5));
$password = hash_hmac('sha256', 'FE008:'.$runId, (string) env('APP_KEY'));
$fixtures = Illuminate\Support\Facades\DB::transaction(function () use ($runId, $password) {
    $schools = [];
    foreach (['A', 'B'] as $label) $schools[$label] = App\Models\School::create(['name' => 'FE008 '.$label.' · тестовый контур', 'region_code' => '66', 'city' => 'Екатеринбург', 'inn' => (string) random_int(1000000000, 9999999999), 'settings' => []]);
    $users = [];
    foreach (['author', 'other', 'director', 'multi', 'admin'] as $role) {
        $users[$role] = App\Models\User::create(['name' => 'FE008 '.$role, 'email' => 'fe008-'.$runId.'-'.$role.'@example.test', 'password' => $password, 'system_role' => $role === 'admin' ? 'system_admin' : 'none', 'is_active' => true]);
        foreach (($role === 'multi' || $role === 'admin') ? ['A', 'B'] : ['A'] as $school) App\Models\SchoolMembership::create(['school_id' => $schools[$school]->id, 'user_id' => $users[$role]->id, 'role' => $role === 'director' ? 'school_admin' : 'teacher', 'is_default' => $school === 'A']);
    }
    $traditions = [];
    foreach (['A', 'B'] as $label) {
        $t = App\Models\SchoolTradition::create(['school_id' => $schools[$label]->id, 'title' => 'Мастерская добрых дел · '.$label, 'description' => 'Участники школы планируют полезные дела, распределяют роли и обсуждают результаты совместной работы.', 'established_year' => 2005, 'created_by_user_id' => $users['author']->id]);
        foreach (['2024-2025', '2025-2026', '2026-2027'] as $i => $year) App\Models\TraditionVersion::create(['tradition_id' => $t->id, 'academic_year' => $year, 'parameters_snapshot' => ['concept' => ['title' => $t->title, 'description' => $t->description], 'participants' => 'Школьное сообщество'], 'notes' => 'Отдельный выпуск традиции на '.$year.'. Исторические сведения сохраняются.', 'created_by_user_id' => $users['author']->id, 'created_at' => now()->subDays(3 - $i)]);
        $traditions[$label] = $t->id;
    }
    $events = [];
    foreach (['approved', 'draft', 'foreign'] as $kind) {
        $event = App\Models\CalendarEvent::create(['title' => 'FE008 '.$kind.' '.$runId, 'event_type' => $kind === 'foreign' ? 'school_custom' : 'federal', 'school_id' => $kind === 'foreign' ? $schools['B']->id : null, 'date_type' => 'fixed_annual', 'fixed_month' => 10, 'fixed_day' => 26, 'description' => 'Изолированный повод для проверки конструктора', 'target_age_groups' => ['basic_5_9'], 'recommended_value_directions' => ['mutual_aid'], 'status' => $kind === 'draft' ? 'draft' : 'approved', 'created_by_user_id' => $users['author']->id]);
        $events[$kind] = $event->id;
    }
    $source = App\Models\EventSource::create(['calendar_event_id' => $events['approved'], 'source_type' => 'scientific_publication', 'title' => 'Тестовый первоисточник FE008 — синтетический fixture', 'author' => 'Интеграционная проверка', 'url' => 'https://example.test/fe008-source']);
    App\Models\SourceReview::create(['event_source_id' => $source->id, 'reviewer_user_id' => $users['admin']->id, 'decision' => 'approved', 'comments' => 'Синтетическая проверка связи источника, не историческая аттестация.', 'reviewed_at' => now()]);
    $claim = App\Models\CulturalClaim::create(['calendar_event_id' => $events['approved'], 'culture_name' => 'Тестовый культурный контекст', 'claim_text' => 'Тестовая формулировка для проверки связывания доказательств.', 'provenance_notes' => 'Синтетические сведения для изолированного HTTP E2E.', 'created_by_user_id' => $users['admin']->id]);
    App\Models\CulturalClaimSource::create(['calendar_event_id' => $events['approved'], 'cultural_claim_id' => $claim->id, 'event_source_id' => $source->id, 'citation_locator' => 'Тестовый раздел 1', 'citation_excerpt' => 'Синтетическая цитата только для интеграционной проверки.', 'verification_status' => 'verified_authentic', 'verified_by_user_id' => $users['admin']->id, 'verified_at' => now(), 'applicable_academic_year' => '2026-2027', 'is_detached' => false, 'created_at' => now()]);
    $versions = []; foreach (['A', 'B'] as $label) $versions[$label] = App\Models\TraditionVersion::where('tradition_id', $traditions[$label])->orderByDesc('created_at')->first()->id;
    return ['sourceId' => $source->id, 'claimId' => $claim->id, 'queue' => 'fe008_'.$runId, 'events' => $events, 'versions' => $versions, 'baselineGenerationRuns' => App\Models\GenerationRun::count(), 'schools' => array_map(fn ($s) => ['id' => $s->id, 'name' => $s->name], $schools), 'users' => array_map(fn ($u) => ['id' => $u->id, 'email' => $u->email], $users), 'traditions' => $traditions];
});
echo json_encode(['database' => 'school_events_test', 'environment' => 'testing', 'databaseUser' => $databaseUser, 'runId' => $runId, ...$fixtures], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

