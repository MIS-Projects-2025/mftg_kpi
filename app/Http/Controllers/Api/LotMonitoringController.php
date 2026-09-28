<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LotMonitoringController extends Controller
{
    /* ── GET /api/lot-monitoring/lots ────────────────────────── */
    public function lots(Request $request)
    {
        set_time_limit(120);
        DB::statement("SET SESSION eq_range_index_dive_limit = 0");

        $date    = $request->get('date',    null);
        $factory = $request->get('factory', null);
        $status  = $request->get('status',  null);
        $search  = $request->get('search',  null);
        $page    = max(1, (int)$request->get('page', 1));
        $perPage = (int)$request->get('per_page', 100);

        // Get area map from package_list
        DB::connection('qdn_db')->reconnect();

        $factoryParts = null;
        if ($factory) {
            $factoryParts = DB::connection('qdn_db')
                ->table('package_list')
                ->where('areas', $factory)
                ->whereNotNull('devicename')
                ->where('devicename', '!=', '')
                ->distinct()
                ->pluck('devicename')
                ->toArray();
        }

        // Build loadingplan base query
        $lpQuery = DB::table('loadingplan')
            ->when($date,         fn($q) => $q->whereRaw("DATE(Date_Loaded) = ?", [$date]))
            ->when($factoryParts, fn($q) => $q->whereIn('Part_Name', $factoryParts))
            ->when($search,       fn($q) => $q->where(function($q2) use ($search) {
                $q2->where('Lot_Id',    'like', "%$search%")
                   ->orWhere('Part_Name','like', "%$search%");
            }));

        // Get all matching lot IDs with plan qty first
        $allLots = $lpQuery->clone()
            ->select('Lot_Id','Part_Name','Qty','Focus_Group','Date_Loaded','Start_Time','Package_Name','Station')
            ->orderBy('Date_Loaded','desc')
            ->orderBy('Lot_Id')
            ->get();

        if ($allLots->isEmpty()) {
            return response()->json([
                'lots'    => [],
                'summary' => $this->emptySummary(),
                'total'   => 0,
                'page'    => $page,
                'per_page'=> $perPage,
                'pages'   => 0,
            ]);
        }

        // Get actual output for all lots in one query
        $allLotIds = $allLots->pluck('Lot_Id')->unique()->toArray();
        $outputs = DB::table('telford_out')
            ->whereIn('Lot_Id', $allLotIds)
            ->select('Lot_Id', DB::raw('SUM(Qty) as actual_qty'), DB::raw('MAX(Out_Date) as last_out_date'))
            ->groupBy('Lot_Id')
            ->get()
            ->keyBy('Lot_Id');

        // Get area map for the parts we have
        $partNames = $allLots->pluck('Part_Name')->unique()->toArray();
        $areaRows  = DB::connection('qdn_db')
            ->table('package_list')
            ->whereIn('devicename', $partNames)
            ->whereIn('areas', ['F1','F2','F3'])
            ->select('devicename','areas')
            ->get();
        $areaMap = [];
        foreach ($areaRows as $r) { $areaMap[$r->devicename] = $r->areas; }

        // Build full result with computed fields
        $result = $allLots->map(function($lot) use ($outputs, $areaMap) {
            $out        = $outputs->get($lot->Lot_Id);
            $actualQty  = $out ? (int)$out->actual_qty  : 0;
            $planQty    = (int)($lot->Qty ?? 0);
            $lastOutDate= $out?->last_out_date ?? null;
            $attainment = $planQty > 0 ? round(($actualQty / $planQty) * 100, 1) : 0;
            $status     = $actualQty > 0 ? 'done' : 'not_started';
            $variance   = $planQty - $actualQty;
            $leadtime   = null;
            if ($lastOutDate && $lot->Date_Loaded) {
                $d1 = new \DateTime(substr($lot->Date_Loaded, 0, 10));
                $d2 = new \DateTime(substr($lastOutDate, 0, 10));
                $leadtime = $d1->diff($d2)->days;
            }
            return [
                'lot_id'        => $lot->Lot_Id,
                'part_name'     => $lot->Part_Name,
                'focus_group'   => $lot->Focus_Group,
                'package_name'  => $lot->Package_Name,
                'factory'       => $areaMap[$lot->Part_Name] ?? null,
                'plan_qty'      => $planQty,
                'actual_qty'    => $actualQty,
                'variance'      => $variance,
                'date_loaded'   => $lot->Date_Loaded ? substr($lot->Date_Loaded, 0, 16) : null,
                'start_time'    => $lot->Start_Time,
                'last_out_date' => $lastOutDate ? substr($lastOutDate, 0, 16) : null,
                'leadtime_days' => $leadtime,
                'attainment'    => $attainment,
                'status'        => $status,
            ];
        });

        // Apply status filter
        if ($status) {
            $result = $result->filter(fn($r) => $r['status'] === $status)->values();
        }

        // Summary from full filtered result
        $summary = [
            'total'        => $result->count(),
            'done'         => $result->where('status','done')->count(),
            'not_started'  => $result->where('status','not_started')->count(),
            'total_plan'   => $result->sum('plan_qty'),
            'total_actual' => $result->sum('actual_qty'),
            'total_variance'=> $result->sum('variance'),
            'avg_att'      => $result->count() > 0 ? round($result->avg('attainment'), 1) : 0,
            'avg_leadtime' => $result->whereNotNull('leadtime_days')->count() > 0
                ? round($result->whereNotNull('leadtime_days')->avg('leadtime_days'), 1)
                : null,
        ];

        // Paginate
        $total  = $result->count();
        $pages  = $perPage > 0 ? (int)ceil($total / $perPage) : 1;
        $paged  = $result->slice(($page - 1) * $perPage, $perPage)->values();

        return response()->json([
            'lots'     => $paged,
            'summary'  => $summary,
            'total'    => $total,
            'page'     => $page,
            'per_page' => $perPage,
            'pages'    => $pages,
        ]);
    }

    /* ── GET /api/lot-monitoring/dates ───────────────────────── */
    public function dates()
    {
        $dates = DB::table('loadingplan')
            ->whereNotNull('Date_Loaded')
            ->selectRaw('DATE(Date_Loaded) as date')
            ->distinct()
            ->orderBy('date','desc')
            ->limit(60)
            ->pluck('date');

        return response()->json($dates);
    }

    private function emptySummary(): array
    {
        return ['total'=>0,'done'=>0,'not_started'=>0,
                'total_plan'=>0,'total_actual'=>0,'total_variance'=>0,'avg_att'=>0,'avg_leadtime'=>null];
    }
}
