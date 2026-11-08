<?php
declare(strict_types=1);
require '/var/www/html/vendor/autoload.php';
$app=require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;
$db=DB::selectOne('select current_database() as db, current_user as role');
if(!app()->environment('testing')||$db->db!=='school_events_test'||$db->role!=='school_test_user'||!in_array(config('queue.default'),['sync','redis'],true))throw new RuntimeException('LLM0011 test contour/role/sync queue required');
$runId=bin2hex(random_bytes(5));
$password=hash_hmac('sha256','LLM0011:'.$runId,(string)env('APP_KEY'));
try { $data=DB::transaction(function()use($runId,$password){
 $schools=[];
 foreach(['A'=>'66','B'=>'66','C'=>'77']as $label=>$region)$schools[$label]=App\Models\School::create(['name'=>'LLM0011 '.$runId.' '.$label.' · synthetic test school','region_code'=>$region,'city'=>$region==='66'?'Екатеринбург':'Москва','inn'=>(string)random_int(1000000000,9999999999),'settings'=>['description'=>'LLM0011 synthetic data','address'=>'Тестовая улица, 11']]);
 $users=[];
 foreach(['teacher','schoolAdmin','other','foreign','regional','system','inactive','multi']as $role){
  $users[$role]=App\Models\User::create(['name'=>'LLM0011 '.$role.' · synthetic','email'=>'llm0011-'.$runId.'-'.$role.'@example.test','password'=>$password,'system_role'=>$role==='system'?'system_admin':($role==='regional'?'catalog_curator':'none'),'curator_scope'=>$role==='regional'?'regional':null,'curated_region_codes'=>$role==='regional'?['66']:[],'is_active'=>$role!=='inactive']);
  $labels=match($role){'regional','system'=>[],'other'=>['B'],'foreign'=>['C'],'multi'=>['A','B'],default=>['A']};
  foreach($labels as $label)App\Models\SchoolMembership::create(['school_id'=>$schools[$label]->id,'user_id'=>$users[$role]->id,'role'=>$role==='schoolAdmin'?'school_admin':'teacher','is_default'=>$role!=='multi'&&$label===$labels[0]]);
 }
 foreach([false,true]as $archived)App\Models\SchoolTradition::create(['school_id'=>$schools['A']->id,'title'=>'LLM0011 '.$runId.' tradition','description'=>'Synthetic integration fixture','is_archived'=>$archived,'created_by_user_id'=>$users['teacher']->id]);
 $events=[];$sources=[];$claims=[];
 foreach(['regional66','regional77','federal','schoolA','schoolB','schoolC','draft']as $kind){
  $school=match($kind){'schoolA'=>'A','schoolB'=>'B','schoolC'=>'C',default=>null};
  $event=App\Models\CalendarEvent::create(['title'=>'LLM0011 '.$runId.' '.$kind.' · synthetic','event_type'=>$school?'school_custom':($kind==='regional66'||$kind==='regional77'?'regional':'federal'),'school_id'=>$school?$schools[$school]->id:null,'region_code'=>$kind==='regional66'?'66':($kind==='regional77'?'77':null),'date_type'=>'fixed_annual','fixed_month'=>10,'fixed_day'=>29,'description'=>'Synthetic LLM0011 HTTP test data','target_age_groups'=>['basic_5_9'],'recommended_value_directions'=>['mutual_aid'],'status'=>$kind==='draft'?'draft':'approved']);
  $events[$kind]=$event->id;
  if($kind==='regional66') App\Models\EventOccurrence::create(['calendar_event_id'=>$event->id,'academic_year'=>'2026-2027','start_date'=>'2026-10-30','end_date'=>'2026-11-02','source_reference'=>'LLM0011 own synthetic occurrence']);
  $source=App\Models\EventSource::create(['calendar_event_id'=>$event->id,'source_type'=>'normative_act','title'=>'Федеральный закон от 29.12.2004 № 201-ФЗ','author'=>'Российская Федерация','url'=>'http://pravo.gov.ru/proxy/ips/?docbody=&nd=102090226']);$sources[$kind]=$source->id;
  foreach(['primary','sibling']as $part){$claim=App\Models\CulturalClaim::create(['calendar_event_id'=>$event->id,'culture_name'=>'Общегражданский календарь Российской Федерации','claim_text'=>($part === 'primary' ? '4 ноября — День народного единства в Российской Федерации.' : 'День народного единства установлен как нерабочий праздничный день.'),'provenance_notes'=>'Integration fixture; not expert attestation']);$claims[$kind][$part]=$claim->id;}
 }
 return ['schools'=>array_map(fn($s)=>$s->only(['id','name','region_code']),$schools),'users'=>array_map(fn($u)=>$u->only(['id','email','system_role']),$users),'events'=>$events,'sources'=>$sources,'claims'=>$claims];
}); } catch (Throwable $error) {
 fwrite(STDERR, "LLM0011 fixture transaction rolled back; database error details intentionally omitted.\n");
 exit(1);
}
echo json_encode(['runId'=>$runId,'origin'=>'http://localhost:8001','database'=>$db->db,'environment'=>app()->environment(),'databaseUser'=>$db->role,'queue'=>config('queue.default'),'passwordDerivation'=>'HMAC-SHA256(APP_KEY, LLM0011:runId); never persist password','completed'=>false,...$data],JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE);

