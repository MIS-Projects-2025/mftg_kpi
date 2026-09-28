<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Carbon\Carbon;

class ImportFGListData extends Command
{
    protected $signature   = 'fglist:import {--date= : Date to import (YYYY-MM-DD), defaults to today}';
    protected $description = 'Import FG List data from monthly Excel files into fglist_data_sources';

    public function handle()
    {
        ini_set('memory_limit', '2048M');

        $date       = $this->option('date') ? Carbon::parse($this->option('date')) : Carbon::today();
        $year       = $date->format('Y');
        $monthUpper = strtoupper($date->format('F Y')); // e.g. JULY 2026

        $basePath = '\\\\192.168.0.8\\logistic\\DO\\' . $year . ' FILES\\NEW FORMAT ' . $year . '\\GTTODHL ' . $year;
        $folder   = $basePath . '\\' . $monthUpper;

        $this->info("Looking in: {$folder}");

        if (!is_dir($folder)) {
            $this->error("Cannot access folder: {$folder}");
            return 1;
        }

        // Find all Excel files sorted by leading number e.g. "1) file.xlsx"
        $files = collect(array_merge(
            glob($folder . '\\*.xlsx') ?: [],
            glob($folder . '\\*.xls')  ?: []
        ))
        ->filter()
        ->sortBy(function ($path) {
            preg_match('/^(\d+)\)/', basename($path), $m);
            return isset($m[1]) ? (int) $m[1] : 9999;
        })
        ->values();

        if ($files->isEmpty()) {
            $this->error("No Excel files found in: {$folder}");
            return 1;
        }

        $this->info("Found {$files->count()} file(s)");

        $totalInserted = 0;

        foreach ($files as $filePath) {
            $this->info("Processing: " . basename($filePath));

            try {
                // Load only the DATA SOURCE sheet — read data only (no formatting)
                $reader = IOFactory::createReaderForFile($filePath);
                $reader->setReadDataOnly(true);
                $reader->setLoadSheetsOnly(['DATA SOURCE']);

                $spreadsheet = $reader->load($filePath);
                $sheet       = $spreadsheet->getSheetByName('DATA SOURCE');

                if (!$sheet) {
                    $this->warn("  ⚠ Sheet 'DATA SOURCE' not found — skipping.");
                    $spreadsheet->disconnectWorksheets();
                    unset($spreadsheet);
                    continue;
                }

                // Read all rows into array at once
                $rows = $sheet->toArray(null, true, true, false);

                // Free spreadsheet from memory immediately
                $spreadsheet->disconnectWorksheets();
                unset($spreadsheet);
                gc_collect_cycles();

                if (empty($rows)) {
                    $this->warn("  ⚠ Empty sheet — skipping.");
                    continue;
                }

                // Map column headers
                $headers   = array_map('trim', $rows[0]);
                $headerMap = array_flip($headers);

                $col = [
                    'transaction_id'   => $headerMap['TransactionID']   ?? null,
                    'rto_non_rto'      => $headerMap['RTO/NON-RTO']     ?? null,
                    'destination'      => $headerMap['Destination']      ?? null,
                    'focus_group'      => $headerMap['FocusGroup']       ?? null,
                    'lotno'            => $headerMap['Lotno']            ?? null,
                    'quantity'         => $headerMap['Quantity']         ?? null,
                    'partname'         => $headerMap['Partname']         ?? null,
                    'datecode'         => $headerMap['Datecode']         ?? null,
                    'lead'             => $headerMap['Lead']             ?? null,
                    'package'          => $headerMap['Package']          ?? null,
                    'total_box'        => $headerMap['TotalBox']         ?? null,
                    'lot_type'         => $headerMap['LotType']          ?? null,
                    'transaction_date' => $headerMap['TransactionDate']  ?? null,
                ];

                // Slice off header row and free original array
                $dataRows = array_slice($rows, 1);
                unset($rows);

                $batch = [];

                foreach ($dataRows as $row) {
                    // Skip empty rows
                    if (empty(array_filter($row))) continue;

                    $lotno = isset($col['lotno']) ? trim($row[$col['lotno']] ?? '') : '';
                    if (!$lotno) continue;

                    // Parse transaction_id — Excel stores large numbers in scientific notation
                    $transId = isset($col['transaction_id'])
                        ? (int) $row[$col['transaction_id']]
                        : null;

                    // Parse transaction date
                    $txDate = null;
                    if (isset($col['transaction_date'])) {
                        $raw = $row[$col['transaction_date']];
                        if ($raw) {
                            try {
                                $txDate = is_numeric($raw)
                                    ? \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject($raw)
                                        ->format('Y-m-d H:i:s')
                                    : Carbon::parse($raw)->format('Y-m-d H:i:s');
                            } catch (\Exception $e) {
                                $txDate = null;
                            }
                        }
                    }

                    $batch[] = [
                        'transaction_id'   => $transId,
                        'rto_non_rto'      => isset($col['rto_non_rto'])  ? trim($row[$col['rto_non_rto']]  ?? '') : null,
                        'destination'      => isset($col['destination'])   ? trim($row[$col['destination']]   ?? '') : null,
                        'focus_group'      => isset($col['focus_group'])   ? trim($row[$col['focus_group']]   ?? '') : null,
                        'lotno'            => $lotno,
                        'quantity'         => isset($col['quantity'])      ? (int) ($row[$col['quantity']]    ?? 0) : 0,
                        'partname'         => isset($col['partname'])      ? trim($row[$col['partname']]      ?? '') : null,
                        'datecode'         => isset($col['datecode'])      ? trim($row[$col['datecode']]      ?? '') : null,
                        'lead'             => isset($col['lead'])          ? (int) ($row[$col['lead']]        ?? 0) : 0,
                        'package'          => isset($col['package'])       ? trim($row[$col['package']]       ?? '') : null,
                        'total_box'        => isset($col['total_box'])     ? (int) ($row[$col['total_box']]   ?? 0) : 0,
                        'lot_type'         => isset($col['lot_type'])      ? trim($row[$col['lot_type']]      ?? '') : null,
                        'transaction_date' => $txDate,
                        'created_at'       => now(),
                        'updated_at'       => now(),
                    ];

                    // Insert in batches of 500 rows
                    if (count($batch) >= 500) {
                        $this->upsertBatch($batch);
                        $totalInserted += count($batch);
                        $batch = [];
                        gc_collect_cycles();
                    }
                }

                // Insert remaining rows
                if (!empty($batch)) {
                    $this->upsertBatch($batch);
                    $totalInserted += count($batch);
                }

                unset($dataRows, $batch);
                gc_collect_cycles();

                $this->info("  ✓ Done: " . basename($filePath));

            } catch (\Exception $e) {
                $this->error("  ✗ Error in " . basename($filePath) . ": " . $e->getMessage());
            }
        }

        $this->info("Import complete — Inserted/Updated: {$totalInserted}");
        return 0;
    }

    private function upsertBatch(array $batch): void
    {
        DB::table('fglist_data_sources')->upsert(
            $batch,
            ['transaction_id', 'lotno'],
            [
                'rto_non_rto', 'destination', 'focus_group',
                'quantity', 'partname', 'datecode', 'lead',
                'package', 'total_box', 'lot_type', 'transaction_date',
                'updated_at',
            ]
        );
    }
}

