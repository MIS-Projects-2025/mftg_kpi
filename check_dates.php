<?php
$eidList = "'246','1231','1591','1659','11257','11334','11358'";

$dates = DB::connection('qdn_db')->select(
    "SELECT DATE(datetime) as dt, COUNT(DISTINCT employid) as cnt
     FROM dtr.biometric_logs
     WHERE punch_type='check_in'
     AND employid IN ($eidList)
     GROUP BY DATE(datetime)
     ORDER BY dt DESC
     LIMIT 10"
);
foreach($dates as $r){
    echo 'Date='.$r->dt.' count='.$r->cnt."\n";
}
