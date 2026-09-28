<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class TeamDashboardController extends Controller
{
    private const TEAM_LABELS     = ['2' => 'A', '3' => 'B', '4' => 'C'];
    private const DAY_SHIFT_IDS   = [15, 9, 21];
    private const NIGHT_SHIFT_IDS = [16, 10, 22];

    /* ── GET /api/team-dashboard/teams ──────────────────────────── */
    public function teams()
    {
        return response()->json(['A', 'B', 'C']);
    }

    /* ── GET /api/team-dashboard/factories ──────────────────────── */
    public function factories()
    {
        return response()->json(
            DB::connection('masterlist')
                ->table('employee_masterlist')
                ->select('Factory')
                ->whereIn('Factory', ['F1', 'F2', 'F3'])
                ->distinct()
                ->orderBy('Factory')
                ->pluck('Factory')
        );
    }

    /* ── GET /api/team-dashboard/areas ──────────────────────────── */
    public function areas()
    {
        return response()->json(
            DB::connection('qdn_db')
                ->table('package_list')
                ->select('areas')
                ->whereIn('areas', ['F1', 'F2', 'F3'])
                ->distinct()
                ->orderBy('areas')
                ->pluck('areas')
        );
    }

    /* ── GET /api/team-dashboard/current-period ─────────────────── */
    public function currentPeriod()
    {
        $today  = now()->toDateString();
        $period = DB::connection('scheduler')
            ->table('payroll_cutoff_schedule')
            ->where('PAYROLL_DATE_START', '<=', $today)
            ->where('PAYROLL_DATE_END',   '>=', $today)
            ->select('PAYROLL_DATE_START', 'PAYROLL_DATE_END')
            ->first();

        if (!$period) {
            $period = DB::connection('scheduler')
                ->table('payroll_cutoff_schedule')
                ->where('PAYROLL_DATE_END', '<', $today)
                ->orderBy('PAYROLL_DATE_END', 'desc')
                ->select('PAYROLL_DATE_START', 'PAYROLL_DATE_END')
                ->first();
        }

        return response()->json([
            'from' => $period?->PAYROLL_DATE_START ?? $today,
            'to'   => $period?->PAYROLL_DATE_END   ?? $today,
        ]);
    }

    /* ── GET /api/team-dashboard/periods ────────────────────────── */
    public function periods()
    {
        return response()->json(
            DB::connection('scheduler')
                ->table('payroll_cutoff_schedule')
                ->select('ID', 'PAYROLL_DATE_START', 'PAYROLL_DATE_END')
                ->orderBy('PAYROLL_DATE_START', 'desc')
                ->limit(12)
                ->get()
        );
    }

    /* ── GET /api/team-dashboard/per-day ────────────────────────── */
    public function perDay(Request $request)
    {
        set_time_limit(120);

        $from    = $request->get('from',    now()->startOfMonth()->toDateString());
        $to      = $request->get('to',      now()->toDateString());
        $factory = $request->get('factory', null);
        $area    = $request->get('area',    null);

        // ── 1. Resolve part_names for area filter ─────────────────
        $areaPartNames = null;
        if ($area) {
            $areaPartNames = DB::connection('qdn_db')
                ->table('package_list')
                ->where('areas', $area)
                ->whereNotNull('devicename')
                ->where('devicename', '!=', '')
                ->whereRaw("devicename REGEXP '^[A-Za-z]'")
                ->whereRaw("LENGTH(devicename) > 3")
                ->distinct()
                ->pluck('devicename')
                ->toArray();
        }

        // ── 2. Get employees for Teams A, B, C ────────────────────
        // work_scheduler.EMPID stores EMPLOYID (biometric ID)
        $empQuery = DB::connection('masterlist')
            ->table('employee_masterlist')
            ->select('EMPLOYID', 'TEAM')
            ->whereIn('TEAM', ['2', '3', '4']);

        if ($factory) {
            $empQuery->where('Factory', $factory);
        }

        $employees = $empQuery->get();

        // Key by EMPLOYID for fast scheduler lookup
        $empByEmployid = $employees->keyBy(fn($e) => (string)(int)$e->EMPLOYID);
        $employids     = $employees->pluck('EMPLOYID')->map(fn($e) => (int)$e)->toArray();

        // ── 3. Get work_scheduler records ─────────────────────────
        // work_scheduler.EMPID = EMPLOYID (biometric ID) — confirmed
        // Use WORK_SCHED_STATUS IN (1,2,3) for full coverage
        // Keep latest record per employee (highest ID wins)
        $schedulers = DB::connection('scheduler')
            ->table('work_scheduler')
            ->whereIn('WORK_SCHED_STATUS', [1, 2, 3])
            ->where('PAYROLL_DATE_START', '<=', $to)
            ->where('PAYROLL_DATE_END',   '>=', $from)
            ->whereIn('EMPID', $employids)
            ->select('EMPID', 'SCHEDULE', 'PAYROLL_DATE_START', 'PAYROLL_DATE_END')
            ->orderBy('ID', 'desc')
            ->get()
            ->unique('EMPID'); // latest record per employee

        // ── 4. Get plan per day ────────────────────────────────────
        $includeLoadingPlan = ($factory !== 'F3');
        $includeF3          = ($factory === null || $factory === '' || $factory === 'F3');

        $planByDay = collect();

        if ($includeLoadingPlan) {
            DB::connection('qdn_db')->reconnect();
            $recipeRows = DB::connection('qdn_db')
                ->table('package_list')
                ->whereNotNull('recipe')->where('recipe', '>', 0)
                ->whereNotNull('devicename')->whereNotNull('package_type')
                ->select('devicename', 'package_type', 'recipe')
                ->get();
            $recipeMap = [];
            foreach ($recipeRows as $r) {
                $recipeMap[$r->devicename.'|'.$r->package_type] = (int)$r->recipe;
            }

            $lpQuery = DB::table('loadingplan')
                ->whereRaw("DATE(Date_Loaded) BETWEEN ? AND ?", [$from, $to])
                ->select('Part_Name', 'Package_Name', 'Qty',
                         DB::raw('DATE(Date_Loaded) as load_date'));

            if ($areaPartNames !== null) {
                $lpQuery = !empty($areaPartNames)
                    ? $lpQuery->whereIn('Part_Name', $areaPartNames)
                    : $lpQuery->whereRaw('1=0');
            }

            $lpByDay = $lpQuery->get()->groupBy('load_date')->map(function ($rows) use ($recipeMap) {
                return $rows->sum(function ($p) use ($recipeMap) {
                    $key    = $p->Part_Name.'|'.$p->Package_Name;
                    $recipe = $recipeMap[$key] ?? null;
                    $qty    = (int)($p->Qty ?? 0);
                    return ($recipe && $recipe > 0) ? (int)(floor($qty / $recipe) * $recipe) : $qty;
                });
            });

            foreach ($lpByDay as $date => $qty) {
                $planByDay[$date] = (object)[
                    'plan_qty' => ($planByDay[$date]->plan_qty ?? 0) + $qty,
                ];
            }
        }

        if ($includeF3) {
            $f3ByDay = DB::connection('ppc_db')
                ->table('f3')
                ->whereRaw("DATE(date_loaded) BETWEEN ? AND ?", [$from, $to])
                ->whereNotIn('status', ['SHIPBACK', 'SHIPPED', 'FINAL SHIP', 'FINAL_SHIP'])
                ->select('part_number', 'qty', DB::raw('DATE(date_loaded) as load_date'))
                ->get()
                ->groupBy('load_date')
                ->map(fn($rows) => (int)$rows->sum('qty'));

            foreach ($f3ByDay as $date => $qty) {
                $planByDay[$date] = (object)[
                    'plan_qty' => ($planByDay[$date]->plan_qty ?? 0) + $qty,
                ];
            }
        }

        // ── 5/6. Get DAY + NIGHT output ───────────────────────────
        $toPlus1              = Carbon::parse($to)->addDay()->format('Y-m-d');
        $includeTelfordOutput = ($factory !== 'F3');
        $includeF3Output      = ($factory === null || $factory === '' || $factory === 'F3');

        $dayOutputByDay   = collect();
        $nightOutputByDay = collect();

        if ($includeTelfordOutput) {
            $dayQuery = DB::table('telford_out')
                ->where('Out_Date', '>=', $from . ' 07:00:00')
                ->where('Out_Date', '<=', $to   . ' 18:59:59')
                ->whereRaw('HOUR(Out_Date) >= 7 AND HOUR(Out_Date) <= 18');

            if ($areaPartNames !== null) {
                $dayQuery = !empty($areaPartNames)
                    ? $dayQuery->whereIn('Part_Name', $areaPartNames)
                    : $dayQuery->whereRaw('1=0');
            }

            foreach ($dayQuery->select(DB::raw('DATE(Out_Date) as date'), DB::raw('SUM(Qty) as actual_qty'))
                ->groupByRaw('DATE(Out_Date)')->pluck('actual_qty', 'date') as $date => $qty) {
                $dayOutputByDay[$date] = (object)['actual_qty' => ($dayOutputByDay[$date]->actual_qty ?? 0) + (int)$qty];
            }

            $nightQuery = DB::table('telford_out')
                ->where('Out_Date', '>=', $from    . ' 19:00:00')
                ->where('Out_Date', '<',  $toPlus1 . ' 07:00:00')
                ->where(function ($q) { $q->whereRaw('HOUR(Out_Date) >= 19')->orWhereRaw('HOUR(Out_Date) < 7'); });

            if ($areaPartNames !== null) {
                $nightQuery = !empty($areaPartNames)
                    ? $nightQuery->whereIn('Part_Name', $areaPartNames)
                    : $nightQuery->whereRaw('1=0');
            }

            $nightDateExpr = "DATE(CASE WHEN HOUR(Out_Date) < 7 THEN DATE_SUB(Out_Date, INTERVAL 1 DAY) ELSE Out_Date END)";
            foreach ($nightQuery->select(DB::raw("$nightDateExpr as date"), DB::raw('SUM(Qty) as actual_qty'))
                ->groupByRaw($nightDateExpr)->pluck('actual_qty', 'date') as $date => $qty) {
                $nightOutputByDay[$date] = (object)['actual_qty' => ($nightOutputByDay[$date]->actual_qty ?? 0) + (int)$qty];
            }
        }

        if ($includeF3Output) {
            $f3DayByDate = DB::table('f3_outs')
                ->where('Out_Date', '>=', $from . ' 07:00:00')
                ->where('Out_Date', '<=', $to   . ' 18:59:59')
                ->whereRaw('HOUR(Out_Date) >= 7 AND HOUR(Out_Date) <= 18')
                ->select(DB::raw('DATE(Out_Date) as date'), DB::raw('SUM(Qty) as actual_qty'))
                ->groupByRaw('DATE(Out_Date)')->pluck('actual_qty', 'date');

            foreach ($f3DayByDate as $date => $qty) {
                $dayOutputByDay[$date] = (object)['actual_qty' => ($dayOutputByDay[$date]->actual_qty ?? 0) + (int)$qty];
            }

            $f3NightDateExpr = "DATE(CASE WHEN HOUR(Out_Date) < 7 THEN DATE_SUB(Out_Date, INTERVAL 1 DAY) ELSE Out_Date END)";
            $f3NightByDate = DB::table('f3_outs')
                ->where('Out_Date', '>=', $from    . ' 19:00:00')
                ->where('Out_Date', '<',  $toPlus1 . ' 07:00:00')
                ->where(function ($q) { $q->whereRaw('HOUR(Out_Date) >= 19')->orWhereRaw('HOUR(Out_Date) < 7'); })
                ->select(DB::raw("$f3NightDateExpr as date"), DB::raw('SUM(Qty) as actual_qty'))
                ->groupByRaw($f3NightDateExpr)->pluck('actual_qty', 'date');

            foreach ($f3NightByDate as $date => $qty) {
                $nightOutputByDay[$date] = (object)['actual_qty' => ($nightOutputByDay[$date]->actual_qty ?? 0) + (int)$qty];
            }
        }

        // ── 7. Build per-day result ────────────────────────────────
        $result = [];

        for ($d = Carbon::parse($from); $d->lte(Carbon::parse($to)); $d->addDay()) {
            $dateStr = $d->toDateString();

            $teamDayCount   = ['A' => 0, 'B' => 0, 'C' => 0];
            $teamNightCount = ['A' => 0, 'B' => 0, 'C' => 0];

            foreach ($schedulers as $s) {
                $periodStart = Carbon::parse($s->PAYROLL_DATE_START);
                $periodEnd   = Carbon::parse($s->PAYROLL_DATE_END);
                if ($d->lt($periodStart) || $d->gt($periodEnd)) continue;

                $schedule = json_decode($s->SCHEDULE, true);
                if (!$schedule) continue;

                $dayOfPeriod = (string)($periodStart->diffInDays($d) + 1);
                if (!isset($schedule[$dayOfPeriod])) continue;

                $shiftCodeId = (int)$schedule[$dayOfPeriod];
                $isDay   = in_array($shiftCodeId, self::DAY_SHIFT_IDS);
                $isNight = in_array($shiftCodeId, self::NIGHT_SHIFT_IDS);
                if (!$isDay && !$isNight) continue;

                // KEY FIX: use empByEmployid (keyed by EMPLOYID) not $employees (plain collection)
                $emp = $empByEmployid->get((string)(int)$s->EMPID);
                if (!$emp) continue;

                $teamLabel = self::TEAM_LABELS[$emp->TEAM] ?? null;
                if (!$teamLabel) continue;

                if ($isDay) $teamDayCount[$teamLabel]++;
                else        $teamNightCount[$teamLabel]++;
            }

            // Assign teams: team with most day employees → day, most night → night
            $dayAssign   = ['team' => null, 'count' => 0];
            $nightAssign = ['team' => null, 'count' => 0];

            foreach (['A', 'B', 'C'] as $team) {
                $dc = $teamDayCount[$team]   ?? 0;
                $nc = $teamNightCount[$team] ?? 0;
                if ($dc === 0 && $nc === 0) continue;

                if ($dc >= $nc) {
                    if ($dc > $dayAssign['count']) {
                        $dayAssign = ['team' => $team, 'count' => $dc];
                    }
                } else {
                    if ($nc > $nightAssign['count']) {
                        $nightAssign = ['team' => $team, 'count' => $nc];
                    }
                }
            }

            $totalPlan   = (int)($planByDay->get($dateStr)?->plan_qty      ?? 0);
            $dayPlan     = (int)ceil($totalPlan  / 2);
            $nightPlan   = (int)floor($totalPlan / 2);
            $dayActual   = (int)($dayOutputByDay->get($dateStr)?->actual_qty   ?? 0);
            $nightActual = (int)($nightOutputByDay->get($dateStr)?->actual_qty ?? 0);
            $dayAtt      = $dayPlan   > 0 ? min(100, round(($dayActual   / $dayPlan)   * 100)) : 0;
            $nightAtt    = $nightPlan > 0 ? min(100, round(($nightActual / $nightPlan) * 100)) : 0;

            $result[] = [
                'date'              => $dateStr,
                'day_team'          => $dayAssign['team'],
                'night_team'        => $nightAssign['team'],
                'day_count'         => $dayAssign['count'],
                'night_count'       => $nightAssign['count'],
                'team_day_counts'   => $teamDayCount,
                'team_night_counts' => $teamNightCount,
                'day_plan'          => $dayPlan,
                'night_plan'        => $nightPlan,
                'day_actual'        => $dayActual,
                'night_actual'      => $nightActual,
                'day_att'           => $dayAtt,
                'night_att'         => $nightAtt,
                'total_plan'        => $totalPlan,
                'total_actual'      => $dayActual + $nightActual,
            ];
        }

        return response()->json($result);
    }

    /* ── GET /api/team-dashboard/lot-progress ───────────────────── */
    public function lotProgress(Request $request)
    {
        $date = $request->get('date', now()->toDateString());
        $area = $request->get('area', null);

        DB::connection('qdn_db')->reconnect();
        $recipeRows = DB::connection('qdn_db')
            ->table('package_list')
            ->whereNotNull('recipe')->where('recipe', '>', 0)
            ->whereNotNull('devicename')->whereNotNull('package_type')
            ->select('devicename', 'package_type', 'recipe')
            ->get();
        $recipeMap = [];
        foreach ($recipeRows as $r) {
            $recipeMap[$r->devicename.'|'.$r->package_type] = (int)$r->recipe;
        }

        $plan = DB::table('loadingplan')
            ->whereRaw("DATE(Date_Loaded) = ?", [$date])
            ->select('Lot_Id as lot_id', 'Part_Name as part_name', 'Package_Name as package_name', 'Qty')
            ->get()
            ->map(function ($p) use ($recipeMap) {
                $key       = $p->part_name.'|'.$p->package_name;
                $recipe    = $recipeMap[$key] ?? null;
                $qty       = (int)($p->Qty ?? 0);
                $p->commit = ($recipe && $recipe > 0) ? (int)(floor($qty / $recipe) * $recipe) : $qty;
                return $p;
            });

        if ($plan->isEmpty()) {
            return response()->json([
                'lots' => [], 'total_plan' => 0, 'total_actual' => 0,
                'total_lots' => 0, 'finished_lots' => 0, 'overall_pct' => 0,
            ]);
        }

        if ($area) {
            $areaPartNames = DB::connection('qdn_db')
                ->table('package_list')
                ->where('areas', $area)
                ->whereNotNull('devicename')
                ->where('devicename', '!=', '')
                ->whereRaw("devicename REGEXP '^[A-Za-z]'")
                ->whereRaw("LENGTH(devicename) > 3")
                ->distinct()
                ->pluck('devicename')
                ->toArray();

            if (!empty($areaPartNames)) {
                $plan = $plan->whereIn('part_name', $areaPartNames)->values();
            }
        }

        $nextDay = Carbon::parse($date)->addDay()->format('Y-m-d');
        $outputs = DB::table('telford_out')
            ->where('Out_Date', '>=', $date    . ' 06:00:00')
            ->where('Out_Date', '<',  $nextDay . ' 06:00:00')
            ->whereIn('Lot_Id', $plan->pluck('lot_id'))
            ->select('Lot_Id', DB::raw('SUM(Qty) as actual_qty'))
            ->groupBy('Lot_Id')
            ->get()
            ->keyBy('Lot_Id');

        $result = $plan->map(function ($p) use ($outputs) {
            $out     = $outputs->get($p->lot_id);
            $actual  = $out ? (int)$out->actual_qty : 0;
            $planQty = (int)$p->commit;
            $pct     = $planQty > 0 ? min(100, round(($actual / $planQty) * 100)) : 0;
            return [
                'lot_id'     => $p->lot_id,
                'part_name'  => $p->part_name,
                'plan_qty'   => $planQty,
                'actual_qty' => $actual,
                'attainment' => $pct,
                'finished'   => $pct >= 100,
                'status'     => $pct >= 100 ? 'done' : ($actual > 0 ? 'in_progress' : 'not_started'),
            ];
        })->sortByDesc('attainment')->values();

        return response()->json([
            'lots'          => $result,
            'total_plan'    => $plan->sum('commit'),
            'total_actual'  => $outputs->sum('actual_qty'),
            'total_lots'    => $plan->count(),
            'finished_lots' => $result->where('finished', true)->count(),
            'overall_pct'   => $plan->sum('commit') > 0
                ? min(100, round(($outputs->sum('actual_qty') / $plan->sum('commit')) * 100))
                : 0,
        ]);
    }
}

