<?php
$file = 'app/Http/Controllers/Api/TeamDashboardController.php';
$c = file_get_contents($file);

$old = '            $f3ByDay = DB::connection(\'ppc_db\')
                ->table(\'f3\')
                ->whereRaw("DATE(date_loaded) BETWEEN ? AND ?", [$from, $to])
                ->select(\'part_number\', \'qty\', DB::raw(\'DATE(date_loaded) as load_date\'))';

$new = '            $f3ByDay = DB::connection(\'ppc_db\')
                ->table(\'f3\')
                ->whereRaw("DATE(date_loaded) BETWEEN ? AND ?", [$from, $to])
                ->whereNotIn(\'status\', [\'SHIPBACK\', \'SHIPPED\'])
                ->select(\'part_number\', \'qty\', DB::raw(\'DATE(date_loaded) as load_date\'))';

if (strpos($c, $old) !== false) {
    $c = str_replace($old, $new, $c);
    file_put_contents($file, $c);
    echo "Fixed\n";
} else {
    echo "Pattern not found\n";
}
