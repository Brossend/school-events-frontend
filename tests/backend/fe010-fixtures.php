<?php
declare(strict_types=1);
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;
$db = DB::connection()->getDatabaseName();
$role = DB::selectOne('select current_user as name')->name;
if (!app()->environment('testing') || $db !== 'school_events_test' || $role !== 'school_test_user') throw new RuntimeException('FE010 isolated database guard refused');
$runId = bin2hex(random_bytes(5));
$password = hash_hmac('sha256', 'FE010:'.$runId, (string) env('APP_KEY'));
$result = DB::transaction(function () use ($runId, $password) {
    $schools = [];
    foreach (['A','B','C','Zero','One','Five','Partial','Real'] as $label) $schools[$label] = App\Models\School::create(['name'=>'FE010 '.$runId.' '.$label.' · SYNTHETIC TEST ONLY', 'region_code'=>$label==='C'?'77':'66','city'=>'Тестовый контур','inn'=>(string)random_int(1000000000,9999999999),'settings'=>[]]);
    $users = [];
    foreach (['teacher','admin','multi','regional','system','systemMember','noMembership'] as $label) {
        $users[$label] = App\Models\User::create(['name'=>'FE010 '.$label,'email'=>'fe010-'.$runId.'-'.$label.'@example.test','password'=>$password,'system_role'=>in_array($label,['system','systemMember'],true)?'system_admin':($label==='regional'?'catalog_curator':'none'),'curator_scope'=>$label==='regional'?'regional':null,'curated_region_codes'=>$label==='regional'?['66']:[],'is_active'=>true]);
        $members = match($label) {'admin'=>array_keys($schools),'multi'=>['A','B'],'regional'=>['A','B','C'],'systemMember','teacher'=>['A'],default=>[]};
        foreach($members as $s) App\Models\SchoolMembership::create(['school_id'=>$schools[$s]->id,'user_id'=>$users[$label]->id,'role'=>$label==='admin'?'school_admin':'teacher','is_default'=>$s==='A']);
    }
    $events=[];
    foreach(['approved','unverified'] as $kind) $events[$kind]=App\Models\CalendarEvent::create(['title'=>'FE010 '.$runId.' '.$kind.' SYNTHETIC','event_type'=>'federal','date_type'=>'fixed_annual','fixed_month'=>10,'fixed_day'=>28,'description'=>'Изолированное тестовое событие','target_age_groups'=>['basic_5_9'],'recommended_value_directions'=>['mutual_aid'],'status'=>'approved','created_by_user_id'=>$users['admin']->id])->id;
    $source=App\Models\EventSource::create(['calendar_event_id'=>$events['approved'],'source_type'=>'scientific_publication','title'=>'FE010 '.$runId.' synthetic fixture source','author'=>'HTTP test','url'=>'https://example.test/fe010']);
    App\Models\SourceReview::create(['event_source_id'=>$source->id,'reviewer_user_id'=>$users['system']->id,'decision'=>'approved','comments'=>'Synthetic evidence fixture only','reviewed_at'=>now()]);
    $claim=App\Models\CulturalClaim::create(['calendar_event_id'=>$events['approved'],'culture_name'=>'Тестовый контекст','claim_text'=>'Синтетическое утверждение для проверки API.','provenance_notes'=>'FE010 '.$runId.' synthetic fixture','created_by_user_id'=>$users['admin']->id]);
    App\Models\CulturalClaimSource::create(['calendar_event_id'=>$events['approved'],'cultural_claim_id'=>$claim->id,'event_source_id'=>$source->id,'citation_locator'=>'Fixture 1','citation_excerpt'=>'Synthetic test evidence only','verification_status'=>'verified_authentic','verified_by_user_id'=>$users['system']->id,'verified_at'=>now(),'applicable_academic_year'=>'2026-2027','is_detached'=>false,'created_at'=>now()]);
    return ['schools'=>array_map(fn($s)=>$s->only(['id','name','region_code']),$schools),'users'=>array_map(fn($u)=>$u->only(['id','email','system_role','curator_scope','curated_region_codes']),$users),'events'=>$events,'sourceId'=>$source->id,'claimId'=>$claim->id];
});
echo json_encode(['database'=>$db,'environment'=>app()->environment(),'databaseUser'=>$role,'queueConnection'=>config('queue.default'),'runId'=>$runId,...$result],JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE);

