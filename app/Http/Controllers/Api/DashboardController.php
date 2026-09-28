<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    /* ── GET /api/dashboard/areas ────────────────────────────────── */
    public function areas()
{
    $areas = DB::connection('qdn_db')
        ->table('package_list')
        ->select('areas')
        ->whereNotNull('areas')
        ->where('areas', '!=', '')
        ->whereNotNull('focus_grp')
        ->where('focus_grp', '!=', '')
        ->distinct()
        ->orderBy('areas')
        ->pluck('areas')
        ->filter()
        ->unique()
        ->values();

    return response()->json($areas);
}

    /* ── GET /api/dashboard/summary ─────────────────────────────── */
    public function summary(Request $request)
    {
        $date  = $request->get('date',  now()->toDateString());
        $shift = $request->get('shift', null);
        $area  = $request->get('area',  null);

        $rows = $this->getRows($date, $shift, $area);

        return response()->json([
            'total_qty'          => $rows->sum('quantity'),
            'total_lots'         => $rows->pluck('lotno')->unique()->count(),
            'total_parts'        => $rows->pluck('partname')->unique()->count(),
            'total_focus_groups' => $rows->pluck('focus_group')->unique()->count(),
            'total_entries'      => $rows->count(),
            'total_days'         => $rows->map(fn($r) => substr($r->transaction_date, 0, 10))->unique()->count(),
        ]);
    }

    /* ── GET /api/dashboard/per-hour ────────────────────────────── */
    public function perHour(Request $request)
    {
        $date  = $request->get('date',  now()->toDateString());
        $shift = $request->get('shift', null);
        $area  = $request->get('area',  null);

        $rows = $this->getRows($date, $shift, $area);

        // Group by hour + area
        $grouped = $rows->groupBy(function ($r) {
            $h = (int) date('H', strtotime($r->transaction_date));
            return sprintf('%02d:00', $h) . '|||' . ($r->area ?? '');
        })->map(function ($group, $key) {
            [$hourLabel, $area] = explode('|||', $key);
            $h = (int) $hourLabel;
            return [
                'hour_label' => $hourLabel,
                'hour'       => (int) $h,
                'shift'      => ($h >= 7 && $h < 19) ? 'DAY' : 'NIGHT',
                'area'       => $area ?: null,
                'total_qty'  => $group->sum('quantity'),
                'total_lots' => $group->pluck('lotno')->unique()->count(),
                'entries'    => $group->count(),
            ];
        })->values()->sortBy('hour_label')->values();

        return response()->json($grouped);
    }

    /* ── GET /api/dashboard/per-shift ───────────────────────────── */
    public function perShift(Request $request)
    {
        $date = $request->get('date', now()->toDateString());
        $area = $request->get('area', null);

        $rows = $this->getRows($date, null, $area);

        $grouped = $rows->groupBy(function ($r) {
            $h     = (int) date('H', strtotime($r->transaction_date));
            $shift = ($h >= 7 && $h < 19) ? 'DAY' : 'NIGHT';
            return $shift . '|||' . ($r->area ?? '');
        })->map(function ($group, $key) {
            [$shift, $area] = explode('|||', $key);
            return [
                'shift'      => $shift,
                'area'       => $area ?: null,
                'total_qty'  => $group->sum('quantity'),
                'total_lots' => $group->pluck('lotno')->unique()->count(),
                'entries'    => $group->count(),
            ];
        })->values();

        return response()->json($grouped);
    }

    /* ── GET /api/dashboard/per-day ─────────────────────────────── */
    public function perDay(Request $request)
    {
        $from  = $request->get('from',  now()->startOfMonth()->toDateString());
        $to    = $request->get('to',    now()->toDateString());
        $shift = $request->get('shift', null);
        $area  = $request->get('area',  null);

        // Get focus_group → area map
        $areaMap = $this->getAreaMap();

        $query = DB::table('fglist_data_sources')
            ->whereRaw("DATE(transaction_date) BETWEEN ? AND ?", [$from, $to]);

        if ($shift === 'DAY') {
            $query->whereRaw("HOUR(transaction_date) >= 7 AND HOUR(transaction_date) < 19");
        } elseif ($shift === 'NIGHT') {
            $query->whereRaw("(HOUR(transaction_date) < 7 OR HOUR(transaction_date) >= 19)");
        }

        $rows = $query->get()->map(function ($r) use ($areaMap, $area) {
            $r->area = $areaMap[$r->focus_group] ?? null;
            return $r;
        });

        if ($area) {
            $rows = $rows->filter(fn($r) => $r->area === $area);
        }

        $grouped = $rows->groupBy(function ($r) {
            return substr($r->transaction_date, 0, 10) . '|||' . ($r->area ?? '');
        })->map(function ($group, $key) {
            [$date, $area] = explode('|||', $key);
            return [
                'date'       => $date,
                'area'       => $area ?: null,
                'total_qty'  => $group->sum('quantity'),
                'total_lots' => $group->pluck('lotno')->unique()->count(),
                'entries'    => $group->count(),
            ];
        })->values()->sortBy('date')->values();

        return response()->json($grouped);
    }

    /* ── GET /api/dashboard/per-partname ────────────────────────── */
    public function perPartname(Request $request)
    {
        $date  = $request->get('date',  now()->toDateString());
        $shift = $request->get('shift', null);
        $area  = $request->get('area',  null);

        $rows = $this->getRows($date, $shift, $area);

        $grouped = $rows->groupBy(function ($r) {
            return $r->partname . '|||' . $r->focus_group . '|||' . ($r->area ?? '');
        })->map(function ($group, $key) {
            [$partname, $focusGroup, $area] = explode('|||', $key);
            return [
                'partname'    => $partname,
                'focus_group' => $focusGroup,
                'area'        => $area ?: null,
                'total_qty'   => $group->sum('quantity'),
                'total_lots'  => $group->pluck('lotno')->unique()->count(),
                'entries'     => $group->count(),
            ];
        })->values()
          ->sortByDesc('total_qty')
          ->take(50)
          ->values();

        return response()->json($grouped);
    }

    /* ── GET /api/dashboard/work-centers ────────────────────────── */
    public function workCenters()
    {
        return response()->json([]);
    }

    /* ── helpers ─────────────────────────────────────────────────── */

    // Get area map: focus_grp => areas from qdn_db
    private function getAreaMap(): array
{
    // Get all mappings, prioritize non-null areas
    // If a focus_grp has multiple areas, pick the most frequent valid one
    $rows = DB::connection('qdn_db')
        ->table('package_list')
        ->select('focus_grp', 'areas')
        ->whereNotNull('focus_grp')
        ->where('focus_grp', '!=', '')
        ->whereNotNull('areas')
        ->where('areas', '!=', '')
        ->get();

    // Build map — for duplicate focus_grp, use most frequent area
    $counts = [];
    foreach ($rows as $row) {
        $fg = trim($row->focus_grp);
        $a  = trim($row->areas);
        if (!$fg || !$a) continue;
        $counts[$fg][$a] = ($counts[$fg][$a] ?? 0) + 1;
    }

    $map = [];
    foreach ($counts as $fg => $areas) {
        // pick the area with highest count
        arsort($areas);
        $map[$fg] = array_key_first($areas);
    }

    return $map;
}

    // Get fglist rows for a date, with area mapped from qdn_db
    private function getRows(string $date, ?string $shift, ?string $area)
    {
        $areaMap = $this->getAreaMap();

        $query = DB::table('fglist_data_sources')
            ->whereRaw("DATE(transaction_date) = ?", [$date]);

        if ($shift === 'DAY') {
            $query->whereRaw("HOUR(transaction_date) >= 7 AND HOUR(transaction_date) < 19");
        } elseif ($shift === 'NIGHT') {
            $query->whereRaw("(HOUR(transaction_date) < 7 OR HOUR(transaction_date) >= 19)");
        }

        $rows = $query->get()->map(function ($r) use ($areaMap) {
            $r->area = $areaMap[$r->focus_group] ?? null;
            return $r;
        });

        if ($area) {
            $rows = $rows->filter(fn($r) => $r->area === $area)->values();
        }

        return $rows;
    }
}