<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$ctrl = new \App\Http\Controllers\Api\AttendanceController();
$req = new \Illuminate\Http\Request(['from'=>'2026-09-14','to'=>'2026-09-14']);
$data = json_decode($ctrl->summary($req)->getContent(),true);
foreach($data['summary'] as $t)
    echo 'Team '.$t['team'].' wrong='.$t['sched_wrong'].' late='.$t['sched_late']."\n";
