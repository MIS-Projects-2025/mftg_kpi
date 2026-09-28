<?php

namespace Database\Seeders;

use App\Models\WorkCenter;
use Illuminate\Database\Seeder;

class WorkCenterSeeder extends Seeder
{
    public function run(): void
    {
        $lines = [
            ['code' => 'WB-1', 'name' => 'Wirebond Line 1', 'area' => 'Assembly', 'target_per_hour' => 1200, 'sort_order' => 1],
            ['code' => 'WB-2', 'name' => 'Wirebond Line 2', 'area' => 'Assembly', 'target_per_hour' => 1200, 'sort_order' => 2],
            ['code' => 'MLD-A', 'name' => 'Molding Line A', 'area' => 'Assembly', 'target_per_hour' => 900, 'sort_order' => 3],
            ['code' => 'TRM-1', 'name' => 'Trim & Form 1', 'area' => 'Finishing', 'target_per_hour' => 1000, 'sort_order' => 4],
            ['code' => 'TST-1', 'name' => 'Final Test Line 1', 'area' => 'Test', 'target_per_hour' => 1500, 'sort_order' => 5],
            ['code' => 'TST-2', 'name' => 'Final Test Line 2', 'area' => 'Test', 'target_per_hour' => 1500, 'sort_order' => 6],
            ['code' => 'VIS-1', 'name' => 'Visual Inspection', 'area' => 'Quality', 'target_per_hour' => 2000, 'sort_order' => 7],
            ['code' => 'PKG-1', 'name' => 'Packing Line 1', 'area' => 'Packing', 'target_per_hour' => 1800, 'sort_order' => 8],
        ];

        foreach ($lines as $line) {
            WorkCenter::updateOrCreate(['code' => $line['code']], $line);
        }
    }
}
