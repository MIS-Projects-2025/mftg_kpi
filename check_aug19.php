<?php
$r = DB::connection('qdn_db')->select(
    "SELECT COUNT(DISTINCT employid) as cnt, COUNT(*) as total
     FROM dtr.biometric_logs
     WHERE punch_type='check_in' AND DATE(datetime)='2026-08-19'"
);
echo 'Distinct employees: '.$r[0]->cnt."\n";
echo 'Total records: '.$r[0]->total."\n";
