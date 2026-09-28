<?php
$date = '2026-08-19';

$empids = DB::connection('masterlist')->table('employee_masterlist')
    ->where('ACCSTATUS',1)->where('TEAM','2')
    ->pluck('EMPID')->map(fn($e) => (int)$e)->toArray();

$scheds = DB::connection('scheduler')->table('work_scheduler')
    ->where('PAYROLL_DATE_START','<=',$date)
    ->where('PAYROLL_DATE_END','>=',$date)
    ->whereIn('WORK_SCHED_STATUS',[1,2,3])
    ->whereIn('EMPID',$empids)->get();

// Build shiftMap directly
$shiftRows = DB::connection('scheduler')->table('shift_codes')
    ->whereIn('SHIFT_CODE_ID',[15,16,9,10,21,22,11,12,17,18])
    ->select('SHIFT_CODE_ID','SHIFTCODE','TIME_WINDOWS')->get();
$shiftMap = [];
foreach($shiftRows as $r){
    $w = json_decode($r->TIME_WINDOWS, true);
    if(!$w || empty($w[0])) continue;
    $h = (int)explode(':',$w[0])[0];
    $shiftMap[$r->SHIFT_CODE_ID] = [
        'type'      => ($h>=7&&$h<19)?'day':'night',
        'shiftcode' => $r->SHIFTCODE,
        'late_after'=> \Carbon\Carbon::createFromFormat('H:i',$w[0])->addMinute()->format('H:i:s'),
    ];
}

$schedEmployids = [];
foreach($scheds as $s){
    $sch = json_decode($s->SCHEDULE, true);
    if(!$sch) continue;
    $d = (string)(\Carbon\Carbon::parse($s->PAYROLL_DATE_START)->diffInDays($date)+1);
    if(!array_key_exists($d, $sch)) continue;
    $sid = (int)$sch[$d];
    if(!array_key_exists($sid, $shiftMap)) continue;
    $emp = DB::connection('masterlist')->table('employee_masterlist')
        ->where('EMPID',$s->EMPID)->first();
    if(!$emp) continue;
    $schedEmployids[] = (string)(int)$emp->EMPLOYID;
    echo 'EMPID='.$s->EMPID.' EMPLOYID='.$emp->EMPLOYID.' Shift='.$shiftMap[$sid]['shiftcode']."\n";
}

if(count($schedEmployids) > 0){
    $eidList = "'".implode("','", $schedEmployids)."'";
    $ci = DB::connection('qdn_db')->select(
        "SELECT COUNT(DISTINCT employid) as cnt FROM dtr.biometric_logs
         WHERE punch_type='check_in' AND DATE(datetime)='$date' AND employid IN ($eidList)"
    );
    echo 'Sched Team A with check-in: '.$ci[0]->cnt."\n";
}
echo 'Total sched Team A: '.count($schedEmployids)."\n";
