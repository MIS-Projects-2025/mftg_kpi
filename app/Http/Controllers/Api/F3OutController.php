<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

class F3OutController extends Controller
{
    /* ── GET /api/f3-out ─────────────────────────────────────────── */
    public function index(Request $request)
    {
        $query = DB::table('f3_outs');

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('Part_Name', 'like', "%{$s}%")
                  ->orWhere('Lot_Id',  'like', "%{$s}%")
                  ->orWhere('Package', 'like', "%{$s}%")
                  ->orWhere('test_group', 'like', "%{$s}%");
            });
        }

        if ($request->filled('from')) {
            $query->where('Out_Date', '>=', $request->from);
        }
        if ($request->filled('to')) {
            $query->where('Out_Date', '<=', $request->to);
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

    /* ── POST /api/f3-out/upload ─────────────────────────────────── */
    public function upload(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:20480',
        ]);

        $file = $request->file('file');

        try {
            $spreadsheet = IOFactory::load($file->getPathname());
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Cannot read Excel file: ' . $e->getMessage(),
            ], 422);
        }

        if (!$spreadsheet->sheetNameExists('Sheet2')) {
            return response()->json(['message' => 'Sheet2 not found in uploaded file.'], 422);
        }

        $sheet = $spreadsheet->getSheetByName('Sheet2');

        // formatData=true so date/number cells come back as their displayed
        // string (e.g. "9/7/2026 10:10:10"), which parseExcelDate() below
        // already knows how to parse — same approach as Telford's CSV import.
        $data = $sheet->toArray(null, true, true, false);

        if (empty($data)) {
            return response()->json(['message' => 'Sheet2 is empty.'], 422);
        }

        // First row = headers
        $headers = array_map(fn($h) => trim((string) $h), array_shift($data));
        $col     = array_flip($headers);

        $required = ['DEVICE', 'LOT', 'MOVEOUTDATETIME', 'MOVEOUTQTY'];
        $missing  = array_diff($required, $headers);
        if (!empty($missing)) {
            return response()->json([
                'message' => 'Missing required columns: ' . implode(', ', $missing),
            ], 422);
        }

        $batch    = [];
        $inserted = 0;
        $skipped  = 0;

        foreach ($data as $row) {
            if (empty(array_filter($row, fn($v) => $v !== null && $v !== ''))) continue;

            $device = isset($col['DEVICE']) ? trim((string) ($row[$col['DEVICE']] ?? '')) : '';
            $lot    = isset($col['LOT'])    ? trim((string) ($row[$col['LOT']]    ?? '')) : '';

            if (!$device && !$lot) { $skipped++; continue; }

            $outDate = isset($col['MOVEOUTDATETIME'])
                ? $this->parseExcelDate($row[$col['MOVEOUTDATETIME']] ?? null)
                : null;

            // Out_Date is part of the dedupe key — a row we can't date can't
            // be safely upserted, so treat it like a missing required field.
            if (!$outDate) { $skipped++; continue; }

            $batch[] = [
                // Common columns — shared shape with telford_out
                'Part_Name'   => $device ?: null,
                'Lot_Id'      => $lot    ?: null,
                'Out_Date'    => $outDate,
                'Qty'         => isset($col['MOVEOUTQTY'])  ? (int) ($row[$col['MOVEOUTQTY']] ?? 0) : null,
                'Package'     => isset($col['PACKAGECODE']) ? trim((string) ($row[$col['PACKAGECODE']] ?? '')) : null,
                'Date_Loaded' => isset($col['OUTPUTDATE'])  ? $this->parseExcelDate($row[$col['OUTPUTDATE']] ?? null) : null,

                // Raw COMETS columns — kept for reference/audit
                'year'                => isset($col['YEAR'])             ? (int) ($row[$col['YEAR']] ?? 0)     : null,
                'quarter'             => isset($col['QUARTER'])          ? (int) ($row[$col['QUARTER']] ?? 0)  : null,
                'workweek'            => isset($col['WORKWEEK'])         ? (int) ($row[$col['WORKWEEK']] ?? 0) : null,
                'crd'                 => isset($col['CRD'])              ? trim((string) ($row[$col['CRD']] ?? ''))              : null,
                'tester_type'         => isset($col['TESTERTYPE'])       ? trim((string) ($row[$col['TESTERTYPE']] ?? ''))       : null,
                'tester_config'       => isset($col['TESTERCONFIG'])     ? trim((string) ($row[$col['TESTERCONFIG']] ?? ''))     : null,
                'test_group'          => isset($col['TESTGROUP'])        ? trim((string) ($row[$col['TESTGROUP']] ?? ''))        : null,
                'primary_tester'      => isset($col['PRIMARYTESTER'])    ? trim((string) ($row[$col['PRIMARYTESTER']] ?? ''))    : null,
                'last_used_tester_id' => isset($col['LASTUSEDTESTERID']) ? trim((string) ($row[$col['LASTUSEDTESTERID']] ?? '')) : null,
                'handler_id'          => isset($col['HANDLERID'])        ? trim((string) ($row[$col['HANDLERID']] ?? ''))        : null,
                'package_type'        => isset($col['PACKAGETYPE'])      ? trim((string) ($row[$col['PACKAGETYPE']] ?? ''))      : null,
                'lot_type'            => isset($col['LOTTYPE'])          ? trim((string) ($row[$col['LOTTYPE']] ?? ''))          : null,
                'die_type'            => isset($col['DIETYPE'])          ? trim((string) ($row[$col['DIETYPE']] ?? ''))          : null,
                'opcode'              => isset($col['OPCODE'])           ? trim((string) ($row[$col['OPCODE']] ?? ''))           : null,
                'oper_type'           => isset($col['OPERTYPE'])         ? trim((string) ($row[$col['OPERTYPE']] ?? ''))         : null,
                'division'            => isset($col['DIVISION'])         ? trim((string) ($row[$col['DIVISION']] ?? ''))         : null,
                'building'            => isset($col['BUILDING'])         ? trim((string) ($row[$col['BUILDING']] ?? ''))         : null,
                'tester_category'     => isset($col['TESTERCATEGORY'])   ? trim((string) ($row[$col['TESTERCATEGORY']] ?? ''))   : null,
                'test_system'         => isset($col['SYSTEM'])           ? trim((string) ($row[$col['SYSTEM']] ?? ''))           : null,
                'process'             => isset($col['PROCESS'])          ? trim((string) ($row[$col['PROCESS']] ?? ''))          : null,

                'created_at' => now(),
                'updated_at' => now(),
            ];

            if (count($batch) >= 500) {
                DB::table('f3_outs')->upsert(
                    $batch,
                    ['Lot_Id', 'Out_Date'],
                    $this->updateColumns()
                );
                $inserted += count($batch);
                $batch = [];
            }
        }

        if (!empty($batch)) {
            DB::table('f3_outs')->upsert(
                $batch,
                ['Lot_Id', 'Out_Date'],
                $this->updateColumns()
            );
            $inserted += count($batch);
        }

        return response()->json([
            'message'  => "Import complete — {$inserted} rows inserted/updated, {$skipped} skipped.",
            'inserted' => $inserted,
            'skipped'  => $skipped,
        ]);
    }

    /** Columns to refresh on conflict (everything except the dedupe key itself). */
    private function updateColumns(): array
    {
        return [
            'Part_Name', 'Qty', 'Package', 'Date_Loaded',
            'year', 'quarter', 'workweek', 'crd', 'tester_type', 'tester_config',
            'test_group', 'primary_tester', 'last_used_tester_id', 'handler_id',
            'package_type', 'lot_type', 'die_type', 'opcode', 'oper_type',
            'division', 'building', 'tester_category', 'test_system', 'process',
            'updated_at',
        ];
    }

    /**
     * Parses a cell value that may be a formatted date string, a raw Excel
     * serial number, or a PHP DateTime — mirrors Telford's parseDate() but
     * also handles the serial-number case PhpSpreadsheet can hand back.
     */
    private function parseExcelDate($value): ?string
    {
        if ($value === null || $value === '') return null;

        if ($value instanceof \DateTimeInterface) {
            return Carbon::instance($value)->format('Y-m-d H:i:s');
        }

        if (is_numeric($value)) {
            try {
                $dt = ExcelDate::excelToDateTimeObject($value);
                return Carbon::instance($dt)->format('Y-m-d H:i:s');
            } catch (\Exception $e) {
                // fall through to string parsing
            }
        }

        $formats = [
            'm/d/Y h:i:s A',   // 9/7/2026 10:10:10 AM
            'm/d/Y h:i:s a',
            'm/d/Y H:i:s',     // 9/7/2026 10:10:10
            'm/d/Y h:i A',
            'm/d/Y',
            'Y-m-d H:i:s',
            'Y-m-d',
        ];

        foreach ($formats as $format) {
            try {
                $dt = Carbon::createFromFormat($format, trim((string) $value));
                if ($dt !== false) return $dt->format('Y-m-d H:i:s');
            } catch (\Exception $e) {
                continue;
            }
        }

        try {
            return Carbon::parse(trim((string) $value))->format('Y-m-d H:i:s');
        } catch (\Exception $e) {
            return null;
        }
    }
}
