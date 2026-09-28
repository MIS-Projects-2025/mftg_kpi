<?php
$date = '2026-08-19';
$eidList = "'246','1231','1591','1659','11257','11334','11358','11415'";

$ci = DB::connection('qdn_db')->select(
    "SELECT employid, MIN(TIME(datetime)) as first_in
     FROM dtr.biometric_logs
     WHERE punch_type='check_in' AND DATE(datetime)='$date'
     AND employid IN ($eidList)
     GROUP BY employid"
);
foreach($ci as $r){
    echo 'EMPLOYID='.$r->employid.' check_in='.$r->first_in."\n";
}
echo 'Count: '.count($ci)."\n";
