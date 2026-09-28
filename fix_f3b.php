<?php
$file = 'app/Http/Controllers/Api/TeamDashboardController.php';
$c = file_get_contents($file);

$old = "->whereNotIn('status', ['SHIPBACK', 'SHIPPED'])";
$new = "->whereNotIn('status', ['SHIPBACK', 'SHIPPED', 'FINAL SHIP', 'FINAL_SHIP'])";

if (strpos($c, $old) !== false) {
    $c = str_replace($old, $new, $c);
    file_put_contents($file, $c);
    echo "Fixed\n";
} else {
    echo "Pattern not found\n";
}
