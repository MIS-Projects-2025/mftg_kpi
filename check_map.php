<?php
$date = '2026-08-19';

// Check if 246 checked in
$ci = DB::connection('qdn_db')->select(
    "SELECT employid, MIN(TIME(datetime)) as first_in
     FROM dtr.biometric_logs
     WHERE punch_type='check_in' AND DATE(datetime)='$date'
     AND employid = '246'
     GROUP BY employid"
);
echo '246 check-in: '.(count($ci)>0 ? $ci[0]->first_in : 'NONE')."\n";

// Check a sample of the 1328 who checked in - are any Team A scheduled?
$schedEids = ['246','1231','1591','1659','11257','11334','11358','11415',
              '12213','12278','13214','13693','13896','14075','14238'];
$eidList = "'".implode("','", $schedEids)."'";
$found = DB::connection('qdn_db')->select(
    "SELECT employid, MIN(TIME(datetime)) as first_in
     FROM dtr.biometric_logs
     WHERE punch_type='check_in' AND DATE(datetime)='$date'
     AND employid IN ($eidList)
     GROUP BY employid"
);
echo 'Scheduled Team A with check-in on Aug 19: '.count($found)."\n";
foreach($found as $r){
    echo 'EMPLOYID='.$r->employid.' time='.$r->first_in."\n";
}
