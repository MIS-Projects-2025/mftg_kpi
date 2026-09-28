<?php

namespace App\Imports;

use App\Models\FglistDataSource;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithBatchInserts;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use PhpOffice\PhpSpreadsheet\Shared\Date;

/**
 * Reads the "FGLIST-DATA SOURCE" sheet (the first sheet of the uploaded
 * workbook) column-by-position rather than by header text, since the
 * source workbook's headers aren't always consistent (e.g. "RTO/NON-RTO").
 *
 * Column order, matching the original template:
 * A TransactionID | B RTO/NON-RTO | C Destination | D FocusGroup | E Lotno
 * F Quantity | G Partname | H Datecode | I Lead | J Package | K TotalBox
 * L LotType | M TransactionDate
 */
class FglistDataSourceImport implements ToCollection, WithBatchInserts, WithChunkReading
{
    public int $imported = 0;

    public int $skipped = 0;

    public function collection(Collection $rows): void
    {
        foreach ($rows as $i => $row) {
            // row 0 is the header row — skip it
            if ($i === 0) {
                continue;
            }

            $transactionId = $row[0] ?? null;
            $lotno = $row[4] ?? null;

            if (blank($transactionId) || blank($lotno)) {
                $this->skipped++;

                continue;
            }

            FglistDataSource::updateOrCreate(
                [
                    'transaction_id' => (int) $transactionId,
                    'lotno' => trim((string) $lotno),
                ],
                [
                    'rto_non_rto' => trim((string) ($row[1] ?? '')),
                    'destination' => trim((string) ($row[2] ?? '')),
                    'focus_group' => trim((string) ($row[3] ?? '')),
                    'quantity' => (int) ($row[5] ?? 0),
                    'partname' => trim((string) ($row[6] ?? '')),
                    'datecode' => $row[7] !== null ? trim((string) $row[7]) : null,
                    'lead' => is_numeric($row[8] ?? null) ? (int) $row[8] : null,
                    'package' => trim((string) ($row[9] ?? '')),
                    'total_box' => (int) ($row[10] ?? 1),
                    'lot_type' => trim((string) ($row[11] ?? '')),
                    'transaction_date' => $this->parseDate($row[12] ?? null),
                ]
            );

            $this->imported++;
        }
    }

    private function parseDate($value): ?string
    {
        if (blank($value)) {
            return null;
        }

        try {
            // Excel serial dates come through as numeric from PhpSpreadsheet's
            // shared date system when the cell is formatted as a date.
            if (is_numeric($value)) {
                return Date::excelToDateTimeObject($value)
                    ->format('Y-m-d H:i:s');
            }

            return Carbon::parse((string) $value)->format('Y-m-d H:i:s');
        } catch (\Throwable) {
            return null;
        }
    }

    public function batchSize(): int
    {
        return 200;
    }

    public function chunkSize(): int
    {
        return 200;
    }
}
