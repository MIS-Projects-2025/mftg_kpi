<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LoadingPlanWipController extends Controller
{
    private const TNR_STATIONS = [
        'GTIQA_T','GTTRES_T','GTBKIPBE_T','GTREEL_T','GTBKLDBE_T',
        'GTBKULBE_T','GTTRANS_T','GTTERASE_T','GTCARIER_T','GTARCH_T','GTBATCH_T',
    ];
    private const PIPELINE_STATIONS = ['GTTFVI_T','GTTBOX_T','GTTOQA_T'];
    private const ALL_STATIONS = [
        'GTIQA_T','GTTRES_T','GTBKIPBE_T','GTREEL_T','GTBKLDBE_T',
        'GTBKULBE_T','GTTRANS_T','GTTERASE_T','GTCARIER_T','GTARCH_T','GTBATCH_T',
        'GTTFVI_T','GTTBOX_T','GTTOQA_T',
    ];

    /* ── GET /api/loading-plan/wip-summary ───────────────────── */
    public function summary(Request $request)
    {
        set_time_limit(180);
        DB::statement("SET SESSION eq_range_index_dive_limit = 0");

        $date = $request->get('date', null);

        // ── 1. Area + package map from package_list ───────────────
        DB::connection('qdn_db')->reconnect();
        $pkgList = DB::connection('qdn_db')
            ->table('package_list')
            ->whereNotNull('devicename')
            ->whereNotNull('package_type')
            ->whereIn('areas', ['F1','F2','F3'])
            ->select('devicename','package_type','areas')
            ->get();

        // devicename → areas
        $deviceAreaMap = [];
        // package_type → areas (use first match)
        $pkgAreaMap = [];
        foreach ($pkgList as $r) {
            $deviceAreaMap[$r->devicename] = $r->areas;
            if (!isset($pkgAreaMap[$r->package_type])) {
                $pkgAreaMap[$r->package_type] = $r->areas;
            }
        }

        // ── 2. Get loadingplan rows ───────────────────────────────
        $lpQuery = DB::table('loadingplan')
            ->when($date, fn($q) => $q->whereRaw("DATE(Date_Loaded) = ?", [$date]))
            ->select('Lot_Id','Part_Name','Package_Name','Qty','Station','Lot_Status');

        $lpRows = $lpQuery->get();

        if ($lpRows->isEmpty()) {
            return response()->json([]);
        }

        // ── 3. Get Pull In from ppc_db.ppc_pickupdb ──────────────
        DB::connection('ppc_db')->reconnect();
        $pullInQuery = DB::connection('ppc_db')
            ->table('ppc_pickupdb')
            ->select('PARTNAME','LOTID','QTY','PACKAGE','factory');

        if ($date) {
            $pullInQuery->whereRaw("DATE(DATE_CREATED) = ?", [$date]);
        }

        $pullInRows = $pullInQuery->get();

        // ── 4. Get telford_out actual ─────────────────────────────
        $lotIds = $lpRows->pluck('Lot_Id')->unique()->toArray();
        $fgOut = DB::table('telford_out')
            ->when($date, fn($q) => $q->whereRaw("DATE(Out_Date) = ?", [$date]))
            ->whereIn('Lot_Id', $lotIds)
            ->select('Lot_Id', DB::raw('SUM(Qty) as fg_qty'), 'Part_Name')
            ->groupBy('Lot_Id','Part_Name')
            ->get();

        // ── 5. Compute per Package_Name per Factory ───────────────
        // Group loadingplan by Package_Name
        $result = [];

        foreach ($lpRows as $row) {
            $pkg     = $row->Package_Name;
            $factory = $pkgAreaMap[$pkg] ?? ($deviceAreaMap[$row->Part_Name] ?? 'Unknown');
            $station = $row->Station;
            $qty     = (int)($row->Qty ?? 0);
            $key     = $factory.'|'.$pkg;

            if (!isset($result[$key])) {
                $result[$key] = [
                    'factory'            => $factory,
                    'package_name'       => $pkg,
                    'wip_lots'           => 0,
                    'wip_qty'            => 0,
                    'wip_by_station'     => [],
                    'proc_lots'          => 0,
                    'proc_qty'           => 0,
                    'tnr_lots'           => 0,
                    'tnr_qty'            => 0,
                    'pipeline_lots'      => 0,
                    'pipeline_qty'       => 0,
                    'pipeline_proc_lots' => 0,
                    'pipeline_proc_qty'  => 0,
                    'pull_in_lots'       => 0,
                    'pull_in_qty'        => 0,
                    'fg_qty'             => 0,
                ];
            }

            // Col3: 6AM Starting WIP — all stations
            if (in_array($station, self::ALL_STATIONS)) {
                $result[$key]['wip_lots']++;
                $result[$key]['wip_qty'] += $qty;
                if (!isset($result[$key]['wip_by_station'][$station])) {
                    $result[$key]['wip_by_station'][$station] = ['lots'=>0,'qty'=>0];
                }
                $result[$key]['wip_by_station'][$station]['lots']++;
                $result[$key]['wip_by_station'][$station]['qty'] += $qty;
            }

            // Col4: 6AM Processable WIP — exclude HOLD, exclude GTBKIPBE_T & GTBKULBE_T
            $excludeProcStations = ['GTBKIPBE_T','GTBKULBE_T'];
            if (in_array($station, self::ALL_STATIONS)
                && strtoupper($row->Lot_Status) !== 'HOLD'
                && !in_array($station, $excludeProcStations)) {
                $result[$key]['proc_lots']++;
                $result[$key]['proc_qty'] += $qty;
            }

            // Col6: TNR Commit stations
            if (in_array($station, self::TNR_STATIONS)) {
                $result[$key]['tnr_lots']++;
                $result[$key]['tnr_qty'] += $qty;
            }

            // Col7 & Col11: Pipeline
            if (in_array($station, self::PIPELINE_STATIONS)) {
                $result[$key]['pipeline_lots']++;
                $result[$key]['pipeline_qty'] += $qty;
                // Col11: Left at Pipeline (exclude HOLD)
                if (strtoupper($row->Lot_Status) !== 'HOLD') {
                    $result[$key]['pipeline_proc_lots']++;
                    $result[$key]['pipeline_proc_qty'] += $qty;
                }
            }
        }

        // ── 6. Add Pull In per package ────────────────────────────
        foreach ($pullInRows as $pi) {
            $pkg     = $pi->PACKAGE ?? null;
            // factory column is empty — look up via PARTNAME → devicename → areas
            $factory = $deviceAreaMap[$pi->PARTNAME] ?? ($pkgAreaMap[$pkg] ?? 'Unknown');
            $key     = $factory.'|'.$pkg;

            if (!isset($result[$key])) {
                $result[$key] = [
                    'factory'            => $factory,
                    'package_name'       => $pkg,
                    'wip_lots'           => 0, 'wip_qty'           => 0,
                    'wip_by_station'     => [],
                    'proc_lots'          => 0, 'proc_qty'          => 0,
                    'tnr_lots'           => 0, 'tnr_qty'           => 0,
                    'pipeline_lots'      => 0, 'pipeline_qty'      => 0,
                    'pipeline_proc_lots' => 0, 'pipeline_proc_qty' => 0,
                    'pull_in_lots'       => 0, 'pull_in_qty'       => 0,
                    'fg_qty'             => 0,
                ];
            }
            $result[$key]['pull_in_lots']++;
            $result[$key]['pull_in_qty'] += (int)($pi->QTY ?? 0);
        }

        // ── 7. Add FG Out per package ─────────────────────────────
        // Build lot → package map from loadingplan
        $lotPkgMap = $lpRows->keyBy('Lot_Id')->map(fn($r) => [
            'pkg'     => $r->Package_Name,
            'factory' => $pkgAreaMap[$r->Package_Name] ?? ($deviceAreaMap[$r->Part_Name] ?? 'Unknown'),
        ]);

        foreach ($fgOut as $fg) {
            $info = $lotPkgMap->get($fg->Lot_Id);
            if (!$info) continue;
            $key = $info['factory'].'|'.$info['pkg'];
            if (isset($result[$key])) {
                $result[$key]['fg_qty'] += (int)($fg->fg_qty ?? 0);
            }
        }

        // ── 8. Compute derived columns and format ─────────────────
        $formatted = collect($result)->map(function($r) {
            $tnrCommit   = $r['tnr_qty'];
            $pullIn      = $r['pull_in_qty'];
            $pipeline    = $r['pipeline_qty'];
            $totalCommit = $tnrCommit + $pullIn + $pipeline;
            $fgOut       = $r['fg_qty'];
            $delta       = $fgOut - $totalCommit;
            $pct         = $totalCommit > 0 ? round(($fgOut / $totalCommit) * 100, 1) : 0;

            return [
                'factory'            => $r['factory'],
                'package_name'       => $r['package_name'],
                // Col3
                'wip_lots'           => $r['wip_lots'],
                'wip_qty'            => $r['wip_qty'],
                'wip_by_station'     => $r['wip_by_station'],
                // Col4
                'proc_lots'          => $r['proc_lots'],
                'proc_qty'           => $r['proc_qty'],
                // Col5
                'pull_in_lots'       => $r['pull_in_lots'],
                'pull_in_qty'        => $pullIn,
                // Col6
                'tnr_commit_lots'    => $r['tnr_lots'],
                'tnr_commit_qty'     => $tnrCommit,
                'total_tnr_commit'   => $tnrCommit + $pullIn,
                // Col7
                'pipeline_lots'      => $r['pipeline_lots'],
                'pipeline_qty'       => $pipeline,
                // Col8
                'total_commit'       => $totalCommit,
                // Col9
                'fg_out'             => $fgOut,
                // Col10
                'delta'              => $delta,
                // Col11
                'left_pipeline_lots' => $r['pipeline_proc_lots'],
                'left_pipeline_qty'  => $r['pipeline_proc_qty'],
                // Col12
                'attainment_pct'     => $pct,
            ];
        })
        ->sortBy(['factory','package_name'])
        ->values();

        return response()->json($formatted);
    }
}
