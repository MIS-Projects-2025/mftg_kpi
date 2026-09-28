<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class TelfordOutController extends Controller
{
    /* ── GET /api/telford-out ───────────────────────────────────── */
    public function index(Request $request)
    {
        $query = DB::table('telford_out');

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('Part_Name',    'like', "%{$s}%")
                  ->orWhere('Lot_Id',     'like', "%{$s}%")
                  ->orWhere('Focus_Group','like', "%{$s}%")
                  ->orWhere('Package',    'like', "%{$s}%");
            });
        }

        if ($request->filled('from')) {
            $query->where('Out_Date', '>=', $request->from);
        }
        if ($request->filled('to')) {
            $query->where('Out_Date', '<=', $request->to);
        }
        if ($request->filled('focus_group')) {
            $query->where('Focus_Group', $request->focus_group);
        }

        $total = $query->count();
        $rows  = $query->orderByDesc('Out_Date')
                       ->orderByDesc('id')
                       ->limit(500)
                       ->get();

        return response()->json([
            'total' => $total,
            'rows'  => $rows,
        ]);
    }

    /* ── POST /api/telford-out/upload ───────────────────────────── */
    public function upload(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt|max:20480',
        ]);

        $file    = $request->file('file');
        $handle  = fopen($file->getPathname(), 'r');

        if (!$handle) {
            return response()->json(['message' => 'Cannot read file.'], 422);
        }

        // Read header row
        $headers = fgetcsv($handle);
        if (!$headers) {
            fclose($handle);
            return response()->json(['message' => 'Empty CSV file.'], 422);
        }

        // Normalize headers — trim whitespace
        $headers = array_map('trim', $headers);

        // Map expected column names to CSV index
        $col = array_flip($headers);

        $expected = ['Part_Name', 'Lot_Id', 'Out_Date', 'Qty', 'Residual',
                     'Test_Part', 'Test_Lot_Id', 'Focus_Group', 'Package',
                     'Process_Site', 'Test_Site', 'Tray', 'Bulk',
                     'Date_Loaded', 'Process_Group', 'Ramp_Time'];

        // Check required columns exist
        $missing = array_diff(['Part_Name', 'Lot_Id'], $headers);
        if (!empty($missing)) {
            fclose($handle);
            return response()->json([
                'message' => 'Missing required columns: ' . implode(', ', $missing),
            ], 422);
        }

        $batch    = [];
        $inserted = 0;
        $skipped  = 0;

        while (($row = fgetcsv($handle)) !== false) {
            if (empty(array_filter($row))) continue;

            $partName = isset($col['Part_Name']) ? trim($row[$col['Part_Name']] ?? '') : '';
            $lotId    = isset($col['Lot_Id'])    ? trim($row[$col['Lot_Id']]    ?? '') : '';

            if (!$partName && !$lotId) { $skipped++; continue; }

            $batch[] = [
                'Part_Name'     => $partName ?: null,
                'Lot_Id'        => $lotId    ?: null,
                'Out_Date'      => $this->parseDate($col, $row, 'Out_Date'),
                'Qty'           => isset($col['Qty'])       ? (int) ($row[$col['Qty']]       ?? 0) : null,
                'Residual'      => isset($col['Residual'])  ? (int) ($row[$col['Residual']]  ?? 0) : null,
                'Test_Part'     => isset($col['Test_Part'])    ? trim($row[$col['Test_Part']]    ?? '') : null,
                'Test_Lot_Id'   => isset($col['Test_Lot_Id']) ? trim($row[$col['Test_Lot_Id']] ?? '') : null,
                'Focus_Group'   => isset($col['Focus_Group']) ? trim($row[$col['Focus_Group']] ?? '') : null,
                'Package'       => isset($col['Package'])     ? trim($row[$col['Package']]     ?? '') : null,
                'Process_Site'  => isset($col['Process_Site'])? trim($row[$col['Process_Site']]?? '') : null,
                'Test_Site'     => isset($col['Test_Site'])   ? trim($row[$col['Test_Site']]   ?? '') : null,
                'Tray'          => isset($col['Tray'])        ? (int) ($row[$col['Tray']]      ?? 0) : null,
                'Bulk'          => isset($col['Bulk'])        ? (int) ($row[$col['Bulk']]      ?? 0) : null,
                'Date_Loaded'   => $this->parseDate($col, $row, 'Date_Loaded'),
                'Process_Group' => isset($col['Process_Group'])? trim($row[$col['Process_Group']]?? '') : null,
                'Ramp_Time'     => isset($col['Ramp_Time'])   ? trim($row[$col['Ramp_Time']]   ?? '') : null,
                'created_at'    => now(),
                'updated_at'    => now(),
            ];

            if (count($batch) >= 500) {
                DB::table('telford_out')->upsert(
                    $batch,
                    ['Part_Name', 'Lot_Id'],
                    ['Out_Date','Qty','Residual','Test_Part','Test_Lot_Id',
                     'Focus_Group','Package','Process_Site','Test_Site',
                     'Tray','Bulk','Date_Loaded','Process_Group','Ramp_Time','updated_at']
                );
                $inserted += count($batch);
                $batch = [];
            }
        }

        if (!empty($batch)) {
            DB::table('telford_out')->upsert(
                $batch,
                ['Part_Name', 'Lot_Id'],
                ['Out_Date','Qty','Residual','Test_Part','Test_Lot_Id',
                 'Focus_Group','Package','Process_Site','Test_Site',
                 'Tray','Bulk','Date_Loaded','Process_Group','Ramp_Time','updated_at']
            );
            $inserted += count($batch);
        }

        fclose($handle);

        return response()->json([
            'message'  => "Import complete — {$inserted} rows inserted/updated, {$skipped} skipped.",
            'inserted' => $inserted,
            'skipped'  => $skipped,
        ]);
    }

    private function parseDate(array $col, array $row, string $key): ?string
{
    if (!isset($col[$key])) return null;
    $val = trim($row[$col[$key]] ?? '');
    if (!$val) return null;

    $formats = [
        'm/d/Y h:i:s A',   // 07/28/2026 10:57:07 AM
        'm/d/Y h:i:s a',   // 07/28/2026 10:57:07 am
        'm/d/Y H:i:s',     // 07/28/2026 10:57:07
        'm/d/Y h:i A',     // 07/28/2026 10:57 AM
        'm/d/Y',            // 07/28/2026
        'Y-m-d H:i:s',     // 2026-07-28 10:57:07
        'Y-m-d',            // 2026-07-28
    ];

    foreach ($formats as $format) {
        try {
            $dt = Carbon::createFromFormat($format, $val);
            if ($dt !== false) {
                return $dt->format('Y-m-d H:i:s');  // ← full datetime
            }
        } catch (\Exception $e) {
            continue;
        }
    }

    try {
        return Carbon::parse($val)->format('Y-m-d H:i:s');
    } catch (\Exception $e) {
        return null;
    }
}
}
