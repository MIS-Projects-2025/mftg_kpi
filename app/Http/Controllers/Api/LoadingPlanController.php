<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LoadingPlanController extends Controller
{
    private const PIPELINE_STATIONS = ['GTTFVI_T', 'GTTBOX_T', 'GTTOQA_T'];

    private const AREA_STATIONS = [
        'GTBRAND_T','GTIQA_T','GTBKIPBE_T','GTREEL_T','GTBKLDBE_T',
        'GTBKULBE_T','GTTRANS_T','GTTERASE_T','GTCARIER_T','GTARCH_T','GTBATCH_T',
    ];

    private const RES_STATIONS     = ['GTTRES_T'];
    private const SORTING_STATIONS = ['GTTSORT_T'];
    private const LLI_LPI_STATIONS = ['GTTLLI_T', 'GTLPI_T'];

    /* ── GET /api/loading-plan/data ───────────────────────────── */
    public function data(Request $request)
    {
        $areaMap   = $this->getAreaMap();
        $f1Parts   = $areaMap['F1'] ?? [];
        $f2Parts   = $areaMap['F2'] ?? [];
        $recipeMap = $this->getRecipeMap();

        $date = $request->get('date', null); // e.g. 2026-08-04

        $base = fn() => DB::table('loadingplan')
            ->where(function($q) { $q->where('Bake','!=','For Bake')->orWhereNull('Bake'); })
            ->when($date, fn($q) => $q->whereRaw("DATE(Date_Loaded) = ?", [$date]));

        $f1Pipeline = $base()->whereIn('Station', self::PIPELINE_STATIONS)->whereIn('Part_Name',$f1Parts)
            ->select('Lot_Id','Part_Name','Focus_Group','Package_Name','Station','Qty','Lot_Status','Bake')->orderBy('Station')->orderBy('Lot_Id')->get();
        $f2Pipeline = $base()->whereIn('Station', self::PIPELINE_STATIONS)->whereIn('Part_Name',$f2Parts)
            ->select('Lot_Id','Part_Name','Focus_Group','Package_Name','Station','Qty','Lot_Status','Bake')->orderBy('Station')->orderBy('Lot_Id')->get();

        $f1Raw = $base()->whereIn('Station', self::AREA_STATIONS)->whereIn('Part_Name',$f1Parts)
            ->select('Lot_Id','Part_Name','Focus_Group','Package_Name','Station','Qty','Lot_Status','Bake')->orderBy('Station')->orderBy('Lot_Id')->get();
        $f1 = $this->appendCommit($f1Raw, $recipeMap);

        $f2Raw = $base()->whereIn('Station', self::AREA_STATIONS)->whereIn('Part_Name',$f2Parts)
            ->select('Lot_Id','Part_Name','Focus_Group','Package_Name','Station','Qty','Lot_Status','Bake')->orderBy('Station')->orderBy('Lot_Id')->get();
        $f2 = $this->appendCommit($f2Raw, $recipeMap);

        $resF1 = $base()->whereIn('Station', self::RES_STATIONS)->whereIn('Part_Name',$f1Parts)
            ->select('Lot_Id','Part_Name','Focus_Group','Package_Name','Station','Qty','Lot_Status','Bake')->orderBy('Lot_Id')->get();
        $resF2 = $base()->whereIn('Station', self::RES_STATIONS)->whereIn('Part_Name',$f2Parts)
            ->select('Lot_Id','Part_Name','Focus_Group','Package_Name','Station','Qty','Lot_Status','Bake')->orderBy('Lot_Id')->get();

        $sorting = $base()->whereIn('Station', self::SORTING_STATIONS)
            ->select('Lot_Id','Part_Name','Focus_Group','Package_Name','Station','Qty','Lot_Status','Bake')->orderBy('Lot_Id')->get();
        $lliLpi  = $base()->whereIn('Station', self::LLI_LPI_STATIONS)
            ->select('Lot_Id','Part_Name','Focus_Group','Package_Name','Station','Qty','Lot_Status','Bake')->orderBy('Station')->orderBy('Lot_Id')->get();

        $bake = DB::table('loadingplan')->where('Bake','For Bake')
            ->when($date, fn($q) => $q->whereRaw("DATE(Date_Loaded) = ?", [$date]))
            ->select('Lot_Id','Part_Name','Focus_Group','Package_Name','Station','Qty','Lot_Status','Bake')->orderBy('Station')->orderBy('Lot_Id')->get();

        $meta = DB::table('loadingplan')
            ->when($date, fn($q) => $q->whereRaw("DATE(Date_Loaded) = ?", [$date]))
            ->selectRaw('COUNT(*) as total, MAX(created_at) as uploaded_at')->first();

        return response()->json([
            'f1_pipeline'=>$f1Pipeline,'f2_pipeline'=>$f2Pipeline,
            'f1'=>$f1,'f2'=>$f2,'res_f1'=>$resF1,'res_f2'=>$resF2,
            'sorting'=>$sorting,'lli_lpi'=>$lliLpi,'bake'=>$bake,'meta'=>$meta,
        ]);
    }

    /* ── GET /api/loading-plan/summary ───────────────────────── */
    public function summary(Request $request)
    {
        set_time_limit(120);
        DB::statement("SET SESSION eq_range_index_dive_limit = 0");
        DB::unprepared("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
        DB::unprepared("SET SESSION collation_connection = utf8mb4_unicode_ci");

        $date = $request->get('date', null);
        $dateWhere = $date ? "AND DATE(lp.Date_Loaded) = '$date'" : "";

        $areaMap   = $this->getAreaMap();
        $f1Parts   = $areaMap['F1'] ?? [];
        $f2Parts   = $areaMap['F2'] ?? [];
        $recipeMap = $this->getRecipeMap();

        // Build temp tables
        DB::unprepared("DROP TEMPORARY TABLE IF EXISTS tmp_f1_parts");
        DB::unprepared("DROP TEMPORARY TABLE IF EXISTS tmp_f2_parts");
        DB::unprepared("DROP TEMPORARY TABLE IF EXISTS tmp_recipe");

        $col = "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci";
        DB::unprepared("CREATE TEMPORARY TABLE tmp_f1_parts (part_name VARCHAR(150) $col PRIMARY KEY)");
        DB::unprepared("CREATE TEMPORARY TABLE tmp_f2_parts (part_name VARCHAR(150) $col PRIMARY KEY)");
        DB::unprepared("CREATE TEMPORARY TABLE tmp_recipe (part_name VARCHAR(150) $col, pkg_name VARCHAR(100) $col, recipe INT, PRIMARY KEY(part_name, pkg_name))");

        foreach (array_chunk($f1Parts, 500) as $chunk) {
            $vals = implode(',', array_map(fn($v) => "('".addslashes($v)."')", $chunk));
            DB::unprepared("INSERT IGNORE INTO tmp_f1_parts VALUES $vals");
        }
        foreach (array_chunk($f2Parts, 500) as $chunk) {
            $vals = implode(',', array_map(fn($v) => "('".addslashes($v)."')", $chunk));
            DB::unprepared("INSERT IGNORE INTO tmp_f2_parts VALUES $vals");
        }
        foreach (array_chunk($recipeMap, 500, true) as $chunk) {
            $vals = implode(',', array_map(
                fn($recipe, $key) => "('".implode("','", array_map('addslashes', explode('|', $key, 2)))."',$recipe)",
                $chunk, array_keys($chunk)
            ));
            DB::unprepared("INSERT IGNORE INTO tmp_recipe VALUES $vals");
        }

        $pipeList = "'".implode("','", self::PIPELINE_STATIONS)."'";
        $areaList = "'".implode("','", self::AREA_STATIONS)."'";
        $resList  = "'".implode("','", self::RES_STATIONS)."'";
        $sortList = "'".implode("','", self::SORTING_STATIONS)."'";
        $lliList  = "'".implode("','", self::LLI_LPI_STATIONS)."'";

        $rows = DB::select("
            SELECT
                lp.Station,
                COUNT(*) as total_lots,
                SUM(COALESCE(lp.Qty,0)) as total_qty,
                SUM(CASE WHEN lp.Station IN ($pipeList) AND f1p.part_name IS NOT NULL AND (lp.Bake != 'For Bake' OR lp.Bake IS NULL) THEN 1 ELSE 0 END) as f1_pipe_lots,
                SUM(CASE WHEN lp.Station IN ($pipeList) AND f1p.part_name IS NOT NULL AND (lp.Bake != 'For Bake' OR lp.Bake IS NULL) THEN COALESCE(lp.Qty,0) ELSE 0 END) as f1_pipe_qty,
                SUM(CASE WHEN lp.Station IN ($pipeList) AND f2p.part_name IS NOT NULL AND (lp.Bake != 'For Bake' OR lp.Bake IS NULL) THEN 1 ELSE 0 END) as f2_pipe_lots,
                SUM(CASE WHEN lp.Station IN ($pipeList) AND f2p.part_name IS NOT NULL AND (lp.Bake != 'For Bake' OR lp.Bake IS NULL) THEN COALESCE(lp.Qty,0) ELSE 0 END) as f2_pipe_qty,
                SUM(CASE WHEN lp.Station IN ($areaList) AND f1p.part_name IS NOT NULL AND (lp.Bake != 'For Bake' OR lp.Bake IS NULL) THEN 1 ELSE 0 END) as f1_lots,
                SUM(CASE WHEN lp.Station IN ($areaList) AND f1p.part_name IS NOT NULL AND (lp.Bake != 'For Bake' OR lp.Bake IS NULL) THEN COALESCE(lp.Qty,0) ELSE 0 END) as f1_qty,
                SUM(CASE WHEN lp.Station IN ($areaList) AND f1p.part_name IS NOT NULL AND (lp.Bake != 'For Bake' OR lp.Bake IS NULL) THEN COALESCE(FLOOR(COALESCE(lp.Qty,0)/r.recipe)*r.recipe,0) ELSE 0 END) as f1_commit,
                SUM(CASE WHEN lp.Station IN ($areaList) AND f2p.part_name IS NOT NULL AND (lp.Bake != 'For Bake' OR lp.Bake IS NULL) THEN 1 ELSE 0 END) as f2_lots,
                SUM(CASE WHEN lp.Station IN ($areaList) AND f2p.part_name IS NOT NULL AND (lp.Bake != 'For Bake' OR lp.Bake IS NULL) THEN COALESCE(lp.Qty,0) ELSE 0 END) as f2_qty,
                SUM(CASE WHEN lp.Station IN ($areaList) AND f2p.part_name IS NOT NULL AND (lp.Bake != 'For Bake' OR lp.Bake IS NULL) THEN COALESCE(FLOOR(COALESCE(lp.Qty,0)/r.recipe)*r.recipe,0) ELSE 0 END) as f2_commit,
                SUM(CASE WHEN lp.Station IN ($resList) AND f1p.part_name IS NOT NULL AND (lp.Bake != 'For Bake' OR lp.Bake IS NULL) THEN 1 ELSE 0 END) as res_f1_lots,
                SUM(CASE WHEN lp.Station IN ($resList) AND f1p.part_name IS NOT NULL AND (lp.Bake != 'For Bake' OR lp.Bake IS NULL) THEN COALESCE(lp.Qty,0) ELSE 0 END) as res_f1_qty,
                SUM(CASE WHEN lp.Station IN ($resList) AND f2p.part_name IS NOT NULL AND (lp.Bake != 'For Bake' OR lp.Bake IS NULL) THEN 1 ELSE 0 END) as res_f2_lots,
                SUM(CASE WHEN lp.Station IN ($resList) AND f2p.part_name IS NOT NULL AND (lp.Bake != 'For Bake' OR lp.Bake IS NULL) THEN COALESCE(lp.Qty,0) ELSE 0 END) as res_f2_qty,
                SUM(CASE WHEN lp.Station IN ($lliList) AND (lp.Bake != 'For Bake' OR lp.Bake IS NULL) THEN 1 ELSE 0 END) as lli_lots,
                SUM(CASE WHEN lp.Station IN ($lliList) AND (lp.Bake != 'For Bake' OR lp.Bake IS NULL) THEN COALESCE(lp.Qty,0) ELSE 0 END) as lli_qty,
                SUM(CASE WHEN lp.Station IN ($sortList) AND (lp.Bake != 'For Bake' OR lp.Bake IS NULL) THEN 1 ELSE 0 END) as sort_lots,
                SUM(CASE WHEN lp.Station IN ($sortList) AND (lp.Bake != 'For Bake' OR lp.Bake IS NULL) THEN COALESCE(lp.Qty,0) ELSE 0 END) as sort_qty,
                SUM(CASE WHEN lp.Bake = 'For Bake' THEN 1 ELSE 0 END) as bake_lots,
                SUM(CASE WHEN lp.Bake = 'For Bake' THEN COALESCE(lp.Qty,0) ELSE 0 END) as bake_qty
            FROM loadingplan lp
            LEFT JOIN tmp_f1_parts f1p ON lp.Part_Name COLLATE utf8mb4_unicode_ci = f1p.part_name
            LEFT JOIN tmp_f2_parts f2p ON lp.Part_Name COLLATE utf8mb4_unicode_ci = f2p.part_name
            LEFT JOIN tmp_recipe r     ON lp.Part_Name COLLATE utf8mb4_unicode_ci = r.part_name AND lp.Package_Name COLLATE utf8mb4_unicode_ci = r.pkg_name
            WHERE 1=1 $dateWhere
            GROUP BY lp.Station
            ORDER BY lp.Station ASC
        ");

        $pipeline = DB::select("
            SELECT
                lp.Station,
                COUNT(*) as total_lots,
                SUM(COALESCE(lp.Qty,0)) as total_qty,
                SUM(CASE WHEN f1p.part_name IS NOT NULL THEN 1 ELSE 0 END) as f1_lots,
                SUM(CASE WHEN f1p.part_name IS NOT NULL THEN COALESCE(lp.Qty,0) ELSE 0 END) as f1_qty,
                SUM(CASE WHEN f2p.part_name IS NOT NULL THEN 1 ELSE 0 END) as f2_lots,
                SUM(CASE WHEN f2p.part_name IS NOT NULL THEN COALESCE(lp.Qty,0) ELSE 0 END) as f2_qty
            FROM loadingplan lp
            LEFT JOIN tmp_f1_parts f1p ON lp.Part_Name COLLATE utf8mb4_unicode_ci = f1p.part_name
            LEFT JOIN tmp_f2_parts f2p ON lp.Part_Name COLLATE utf8mb4_unicode_ci = f2p.part_name
            WHERE lp.Station IN ($pipeList) $dateWhere
            GROUP BY lp.Station
            ORDER BY FIELD(lp.Station,'GTTFVI_T','GTTBOX_T','GTTOQA_T')
        ");

        $pipeline = array_map(function($r) {
            $r->unclass_lots = $r->total_lots - $r->f1_lots - $r->f2_lots;
            $r->unclass_qty  = $r->total_qty  - $r->f1_qty  - $r->f2_qty;
            return $r;
        }, $pipeline);

        DB::unprepared("DROP TEMPORARY TABLE IF EXISTS tmp_f1_parts");
        DB::unprepared("DROP TEMPORARY TABLE IF EXISTS tmp_f2_parts");
        DB::unprepared("DROP TEMPORARY TABLE IF EXISTS tmp_recipe");

        return response()->json([
            'by_station' => $rows,
            'pipeline'   => $pipeline,
        ]);
    }

    /* ── POST /api/loading-plan/upload ───────────────────────── */
    public function upload(Request $request)
    {
        $request->validate(['file' => 'required|file|mimes:csv,txt']);
        $file   = $request->file('file');
        $path   = $file->getRealPath();
        $handle = fopen($path, 'r');
        if (!$handle) return response()->json(['error' => 'Cannot read file'], 422);

        $header    = fgetcsv($handle, 0, "\t");
        $header    = array_map('trim', $header ?? []);
        $delimiter = "\t";
        if (!in_array('Part_Name', $header)) {
            rewind($handle);
            $header    = fgetcsv($handle, 0, ",");
            $header    = array_map('trim', $header ?? []);
            $delimiter = ",";
        }
        if (empty($header) || !in_array('Part_Name', $header)) {
            fclose($handle);
            return response()->json(['error' => 'Cannot parse CSV header'], 422);
        }

        $cols = [
            'Plant','Part_Name','Lead_Count','Package_Name','Lot_Id','Station',
            'Qty','Lot_Type','Prod_Area','Lot_Status','Date_Loaded','Start_Time',
            'Part_Type','Part_Class','Date_Code','Focus_Group','Process_Group',
            'Bulk','Reqd_Time','Lot_Entry_Time','Stage','Stage_Start_Time','CCD',
            'Stage_Run_Days','Lot_Entry_Time_Days','Tray','Backend_Leadtime',
            'OSL_Days','BE_Group','Strategy_Code','CR3','BE_Starttime','BE_OSL_Days',
            'Body_Size','Auto_Part','Ramp_Time','End_Customer','Bake','Bake_Count',
            'Test_Lot_Id','Stock_Position','Assy_Site','Bake_Time_Temp',
        ];

        $stationIdx  = array_search('Station',     $header);
        $dateIdx     = array_search('Date_Loaded',  $header);

        $now=$now=now(); $batch=[]; $inserted=0; $skipped=0;
        while (($row = fgetcsv($handle, 0, $delimiter)) !== false) {
            $station = trim($row[$stationIdx] ?? '');
            if (!preg_match('/_t/i', $station)) { $skipped++; continue; }
            $record = ['created_at'=>$now,'updated_at'=>$now];
            foreach ($cols as $col) {
                $idx = array_search($col, $header);
                $record[$col] = $idx!==false?(trim($row[$idx]??'')?:null):null;
            }
            $batch[] = $record;
            if (count($batch)>=500) {
                $inserted += DB::table('loadingplan')->insertOrIgnore($batch);
                $batch = [];
            }
        }
        if (!empty($batch)) {
            $inserted += DB::table('loadingplan')->insertOrIgnore($batch);
        }
        fclose($handle);

        return response()->json(['success'=>true,'inserted'=>$inserted,'skipped'=>$skipped]);
    }

    /* ── Append commit ────────────────────────────────────────── */
    private function appendCommit($rows, array $recipeMap): \Illuminate\Support\Collection
    {
        return $rows->map(function($row) use ($recipeMap) {
            $key    = $row->Part_Name.'|'.$row->Package_Name;
            $recipe = $recipeMap[$key] ?? null;
            $qty    = (int)($row->Qty ?? 0);
            $commit = ($recipe && $recipe>0) ? (int)(floor($qty/$recipe)*$recipe) : null;
            $row->recipe = $recipe;
            $row->commit = $commit;
            return $row;
        });
    }

    /* ── Recipe map ───────────────────────────────────────────── */
    private function getRecipeMap(): array
    {
        DB::connection('qdn_db')->reconnect();
        $rows = DB::connection('qdn_db')->table('package_list')
            ->whereNotNull('recipe')->where('recipe','>',0)
            ->whereNotNull('devicename')->whereNotNull('package_type')
            ->select('devicename','package_type','recipe')->get();
        $map = [];
        foreach ($rows as $r) { $map[$r->devicename.'|'.$r->package_type] = (int)$r->recipe; }
        return $map;
    }

    /* ── Area map — Part_Name only, no Package_Name filter ────── */
    private function getAreaMap(): array
    {
        DB::connection('qdn_db')->reconnect();
        $f1Parts = DB::connection('qdn_db')->table('package_list')->where('areas','F1')
            ->whereNotNull('devicename')->where('devicename','!=','')
            ->whereRaw("devicename REGEXP '^[A-Za-z]'")->whereRaw("LENGTH(devicename) > 3")
            ->distinct()->pluck('devicename')->toArray();
        $f2Parts = DB::connection('qdn_db')->table('package_list')->where('areas','F2')
            ->whereNotNull('devicename')->where('devicename','!=','')
            ->whereRaw("devicename REGEXP '^[A-Za-z]'")->whereRaw("LENGTH(devicename) > 3")
            ->distinct()->pluck('devicename')->toArray();
        return ['F1'=>$f1Parts,'F2'=>$f2Parts];
    }
}

