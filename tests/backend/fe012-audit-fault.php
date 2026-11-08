<?php
declare(strict_types=1);
require '/var/www/html/vendor/autoload.php';$app=require '/var/www/html/bootstrap/app.php';$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;
$db=DB::selectOne('select current_database() as db,current_user as role');$run=getenv('FE012_RUN');$source=getenv('FE012_SOURCE');$mode=getenv('FE012_FAULT_MODE');
if(!app()->environment('testing')||$db->db!=='school_events_test'||$db->role!=='school_test_user'||!preg_match('/^[a-f0-9]{10}$/',(string)$run)||!preg_match('/^[a-f0-9-]{36}$/',(string)$source)||!in_array($mode,['install','remove'],true))throw new RuntimeException('Fault guard refused');
if(!App\Models\EventSource::whereKey($source)->where('title','like','FE012 '.$run.' %')->exists())throw new RuntimeException('Own fixture required');
$name='fe012_fail_'.$run;
if($mode==='install'){
 $sql=<<<'SQL'
CREATE FUNCTION __NAME__() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.event_source_id = '__SOURCE__'::uuid AND NEW.action = 'invalidated_by_source_amendment' THEN
  RAISE EXCEPTION 'FE012 controlled audit persistence failure';
 END IF;
 RETURN NEW;
END;
$$
SQL;
$sql=str_replace(['__NAME__','__SOURCE__'],[$name,$source],$sql).'; CREATE TRIGGER '.$name.' BEFORE INSERT ON cultural_claim_evidence_audit_events FOR EACH ROW EXECUTE FUNCTION '.$name.'();';
}else{
$sql='DROP TRIGGER IF EXISTS '.$name.' ON cultural_claim_evidence_audit_events; DROP FUNCTION IF EXISTS '.$name.'();';
}
echo json_encode(['database'=>$db->db,'mode'=>$mode,'scope'=>'own synthetic source only','trigger'=>$name,'sql'=>$sql]);
