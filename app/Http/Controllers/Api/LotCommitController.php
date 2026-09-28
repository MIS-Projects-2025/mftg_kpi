<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LotCommitController extends Controller
{
    public function index(Request $request)
    {
        $date = $request->get('date', now()->toDateString());

        // ── STEP 1: Get lot_id + scheduled_date from loading_plan_entries ──
        $planLots = DB::connection('ppc_db')
            ->table('loading_plan_entries')
            ->where('scheduled_date', $date)
            ->where('entry_type', 'lot')
            ->whereNotNull('lot_id')
            ->select('lot_id', 'scheduled_date')
            ->distinct()
            ->get();

        if ($planLots->isEmpty()) {
            return response()->json([
                'commits'        => [],
                'total_plan_qty' => 0,
                'total_actual'   => 0,
                'total_lots'     => 0,
                'finished_lots'  => 0,
                'overall_pct'    => 0,
                'date'           => $date,
            ]);
        }

        $lotIds = $planLots->pluck('lot_id')->toArray();

        // ── STEP 2: Lookup Lot_Id, Qty, recipe_used, commit in lot_commits ──
        $commits = DB::connection('ppc_db')
            ->table('lot_commits')
            ->whereIn('Lot_Id', $lotIds)
            ->select('Lot_Id', 'Qty', 'recipe_used', 'commit')
            ->get()
            ->keyBy('Lot_Id');

        // ── STEP 3: Lookup Lot_Id, Part_Name, Package_Name in customer_data_wip ──
        $wip = DB::connection('ppc_db')
            ->table('customer_data_wip')
            ->whereIn('Lot_Id', $lotIds)
            ->select('Lot_Id', 'Part_Name', 'Package_Name')
            ->get()
            ->keyBy('Lot_Id');

        // ── STEP 4: Actual GOOD qty from customer_data_wip_out ─────
        $wipOut = DB::connection('ppc_db')
            ->table('customer_data_wip_out')
            ->whereIn('lot_id', $lotIds)
            ->select(
                'lot_id',
                DB::raw('SUM(qty) as total_good'),
                DB::raw('COUNT(*) as out_count'),
                DB::raw('MAX(out_date) as last_out_date')
            )
            ->groupBy('lot_id')
            ->get()
            ->keyBy('lot_id');

        // ── STEP 5: Reject qty / scan count still from hourly_outputs ──
        $outputs = DB::table('hourly_outputs')
            ->whereIn('lot_no', $lotIds)
            ->select(
                'lot_no',
                DB::raw('SUM(reject_qty) as total_reject'),
                DB::raw('COUNT(*)        as scan_count')
            )
            ->groupBy('lot_no')
            ->get()
            ->keyBy('lot_no');

        // ── STEP 6: Merge ─────────────────────────────────────────
        $result = $planLots->map(function ($plan) use ($commits, $wip, $wipOut, $outputs) {
            $commit      = $commits->get($plan->lot_id);
            $wipRow      = $wip->get($plan->lot_id);
            $outRow      = $wipOut->get($plan->lot_id);
            $hourlyRow   = $outputs->get($plan->lot_id);

            $totalGood   = $outRow ? (int) $outRow->total_good : 0;
            $totalReject = $hourlyRow ? (int) $hourlyRow->total_reject : 0;
            $planQty     = (int) ($commit?->Qty ?? 0);
            $pct         = $planQty > 0
                ? min(100, round(($totalGood / $planQty) * 100))
                : 0;

            return [
                'lotid'          => $plan->lot_id,
                'scheduled_date' => $plan->scheduled_date,
                'part_name'      => $wipRow?->Part_Name    ?? '—',
                'package_name'   => $wipRow?->Package_Name ?? '—',
                'plan_qty'       => $planQty,
                'recipe_used'    => $commit?->recipe_used  ?? null,
                'commit'         => $commit?->commit        ?? null,
                'actual_good'    => $totalGood,
                'actual_reject'  => $totalReject,
                'out_count'      => $outRow ? (int) $outRow->out_count : 0,
                'last_out_date'  => $outRow?->last_out_date,
                'scan_count'     => $hourlyRow ? (int) $hourlyRow->scan_count : 0,
                'attainment'     => $pct,
                'finished'       => $pct >= 100,
            ];
        });

        // ── STEP 7: Summary ───────────────────────────────────────
        $totalPlanQty    = $commits->sum('Qty');
        $totalActualGood = $wipOut->sum('total_good');
        $finishedLots    = $result->where('finished', true)->count();

        return response()->json([
            'commits'        => $result->values(),
            'total_plan_qty' => (int) $totalPlanQty,
            'total_actual'   => (int) $totalActualGood,
            'total_lots'     => $planLots->count(),
            'finished_lots'  => $finishedLots,
            'overall_pct'    => $totalPlanQty > 0
                ? min(100, round(($totalActualGood / $totalPlanQty) * 100))
                : 0,
            'date'           => $date,
        ]);
    }
}