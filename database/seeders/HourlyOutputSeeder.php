<?php

namespace Database\Seeders;

use App\Models\HourlyOutput;
use App\Models\WorkCenter;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class HourlyOutputSeeder extends Seeder
{
    /**
     * Seeds today's 24 hours (up to the current hour) for every active work
     * center, with realistic variance so the dashboard has something worth
     * looking at out of the box. Swap this for a real data feed / manual
     * entry via the Hourly Output Log in production.
     */
    public function run(): void
    {
        $workCenters = WorkCenter::active()->get();
        $today = Carbon::today();
        $currentHour = Carbon::now()->hour;

        foreach ($workCenters as $wc) {
            for ($hour = 0; $hour <= $currentHour; $hour++) {
                $hourStart = $today->copy()->addHours($hour);
                $shift = match (true) {
                    $hour >= 6 && $hour < 14 => '1st',
                    $hour >= 14 && $hour < 22 => '2nd',
                    default => '3rd',
                };

                // simulate attainment mostly in the 80-105% band, with an
                // occasional bad hour to make the "below target" states visible
                $roll = mt_rand(1, 100);
                $attainment = match (true) {
                    $roll <= 10 => mt_rand(40, 70),   // rough hour
                    $roll <= 30 => mt_rand(70, 90),   // below target
                    default => mt_rand(90, 108),      // on/above target
                };

                $target = $wc->target_per_hour;
                $actual = (int) round($target * $attainment / 100);
                $downtime = $attainment < 70 ? mt_rand(10, 40) : ($attainment < 90 ? mt_rand(0, 15) : 0);
                $reject = (int) round($actual * (mt_rand(0, 3) / 100));

                HourlyOutput::updateOrCreate(
                    ['work_center_id' => $wc->id, 'hour_start' => $hourStart],
                    [
                        'shift' => $shift,
                        'target_qty' => $target,
                        'actual_qty' => $actual,
                        'reject_qty' => $reject,
                        'downtime_minutes' => $downtime,
                        'downtime_reason' => $downtime > 20 ? 'Equipment adjustment' : null,
                        'operator_name' => null,
                        'remarks' => null,
                    ]
                );
            }
        }
    }
}
