<?php

namespace App\Exports;

use App\Models\DeliveryOrder;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class DeliveryOrderSheet implements WithEvents, WithTitle
{
    public function __construct(private DeliveryOrder $deliveryOrder) {}

    public function title(): string
    {
        return 'DELIVERY ORDER';
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $do = $this->deliveryOrder;

                // ---- letterhead ----
                $sheet->setCellValue('B1', 'TELFORD Svc. Phils. Inc.');
                $sheet->setCellValue('B2', 'Linares St., Gateway Business Park');
                $sheet->setCellValue('B3', 'Brgy. Javalera, Gen. Trias, Cavite 4107, Philippines');
                $sheet->setCellValue('B4', 'Tel Nos.: (046) 433 0524 to 36 ∙ Fax No.: (046) 433-0529');

                $sheet->mergeCells('J1:K1');
                $sheet->setCellValue('J1', 'DELIVERY ORDER');
                $sheet->setCellValue('J2', 'TIN 205-375-260-000 VAT');
                $sheet->setCellValue('J4', 'No.');
                $sheet->mergeCells('K4:L4');
                $sheet->setCellValue('K4', $do->do_no);

                // ---- bill to / ship to ----
                $sheet->setCellValue('B6', 'BILL TO');
                $sheet->setCellValue('I6', 'SHIP TO');
                $sheet->setCellValue('B8', $do->bill_to_name);
                $sheet->setCellValue('I8', $do->ship_to_name);
                $billLines = preg_split('/\r\n|\r|\n/', (string) $do->bill_to_address);
                $shipLines = preg_split('/\r\n|\r|\n/', (string) $do->ship_to_address);
                foreach ($billLines as $i => $line) {
                    $sheet->setCellValue('B'.(9 + $i), $line);
                }
                foreach ($shipLines as $i => $line) {
                    $sheet->setCellValue('I'.(9 + $i), $line);
                }

                $sheet->setCellValue('B13', 'ATTN : ');
                $sheet->setCellValue('C13', $do->attn_bill);
                $sheet->setCellValue('I13', 'ATTN : ');
                $sheet->setCellValue('J13', $do->attn_ship);
                $sheet->setCellValue('J14', 'Page 1 of 1');

                // ---- meta strip ----
                $sheet->setCellValue('A16', 'DATE');
                $sheet->setCellValue('B16', $do->order_date->format('Y-m-d'));
                $sheet->setCellValue('F16', 'PURCHASE ORDER NO.');
                $sheet->mergeCells('I16:J16');
                $sheet->setCellValue('I16', 'TERMS OF PAYMENT   '.$do->terms);
                $sheet->setCellValue('F17', $do->po_no ?: 'N/A');

                $sheet->setCellValue('F18', 'DESCRIPTION');
                $sheet->setCellValue('I18', 'Transaction I.D');
                $sheet->setCellValue('F19', 'INTEGRATED CIRCUIT');
                $sheet->setCellValue('H19', 'No.');
                $sheet->mergeCells('I19:J19');
                $sheet->setCellValue('I19', $do->transaction_id);

                // ---- item table (invoice-style: adds Unit Price / Amount) ----
                $headers = ['Non-Rto / Rto', 'Destination', 'Focus Group', 'Lot i.d', 'Qty.',
                    'Partname', 'Date Code', 'Lead', 'Package', 'Boxes', 'Lot Type',
                    'Unit Price', 'Amount'];
                $cols = range('A', 'M');
                foreach ($headers as $i => $h) {
                    $sheet->setCellValue($cols[$i].'21', $h);
                }

                $row = 22;
                foreach ($do->items as $item) {
                    $sheet->setCellValue("A{$row}", $item->rto_non_rto);
                    $sheet->setCellValue("B{$row}", $item->destination);
                    $sheet->setCellValue("C{$row}", $item->focus_group);
                    $sheet->setCellValue("D{$row}", $item->lotno);
                    $sheet->setCellValue("E{$row}", $item->quantity);
                    $sheet->setCellValue("F{$row}", $item->partname);
                    $sheet->setCellValue("G{$row}", $item->datecode);
                    $sheet->setCellValue("H{$row}", $item->lead);
                    $sheet->setCellValue("I{$row}", $item->package);
                    $sheet->setCellValue("J{$row}", $item->total_box);
                    $sheet->setCellValue("K{$row}", $item->lot_type);
                    $sheet->setCellValue("L{$row}", (float) $item->unit_price);
                    $sheet->getStyle("L{$row}")->getNumberFormat()->setFormatCode('#,##0.0000');
                    $sheet->setCellValue("M{$row}", (float) $item->amount);
                    $sheet->getStyle("M{$row}")->getNumberFormat()->setFormatCode('#,##0.00');
                    $row++;
                }

                // ---- G-TOTAL (unit/box counts, mirrors the original template) ----
                $totalRow = 91;
                $sheet->mergeCells("A{$totalRow}:B{$totalRow}");
                $sheet->setCellValue("A{$totalRow}", 'G-TOTAL');
                $sheet->setCellValue("C{$totalRow}", $do->total_units);
                $sheet->setCellValue("D{$totalRow}", 'UNITS');
                $sheet->setCellValue("H{$totalRow}", 'G-TOTAL');
                $sheet->setCellValue("I{$totalRow}", $do->total_boxes);
                $sheet->setCellValue("J{$totalRow}", 'BOXES');

                // ---- invoice-style amount summary ----
                $summaryRow = $totalRow + 2;
                $sheet->mergeCells("J{$summaryRow}:K{$summaryRow}");
                $sheet->setCellValue("J{$summaryRow}", 'Subtotal');
                $sheet->setCellValue("L{$summaryRow}", (float) $do->subtotal);
                $sheet->getStyle("L{$summaryRow}")->getNumberFormat()->setFormatCode('#,##0.00');

                $vatRow = $summaryRow + 1;
                $sheet->mergeCells("J{$vatRow}:K{$vatRow}");
                $sheet->setCellValue("J{$vatRow}", 'VAT ('.number_format($do->vat_rate * 100, 0).'%)');
                $sheet->setCellValue("L{$vatRow}", (float) $do->vat_amount);
                $sheet->getStyle("L{$vatRow}")->getNumberFormat()->setFormatCode('#,##0.00');

                $totalDueRow = $vatRow + 1;
                $sheet->mergeCells("J{$totalDueRow}:K{$totalDueRow}");
                $sheet->setCellValue("J{$totalDueRow}", 'TOTAL AMOUNT DUE ('.$do->currency.')');
                $sheet->setCellValue("L{$totalDueRow}", (float) $do->total_amount);
                $sheet->getStyle("L{$totalDueRow}")->getNumberFormat()->setFormatCode('#,##0.00');
                $sheet->getStyle("J{$totalDueRow}:L{$totalDueRow}")->getFont()->setBold(true)->setSize(12);
                $sheet->getStyle("J{$totalDueRow}:L{$totalDueRow}")->getFill()
                    ->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('F6E9E9');

                // ---- signature blocks ----
                $sigRow = $totalDueRow + 3;
                $sheet->setCellValue("A{$sigRow}", 'Prepared By:');
                $sheet->setCellValue("C{$sigRow}", 'Checked By:');
                $sheet->setCellValue("E{$sigRow}", 'Checked By:');
                $sheet->setCellValue("G{$sigRow}", 'Approved By:');
                $sheet->setCellValue("I{$sigRow}", 'Received the above in good order and condition.');

                $footerRow = $sigRow + 4;
                $sheet->setCellValue("A{$footerRow}", 'TELFORD SVC PHILS., INC');
                $sheet->setCellValue("M{$footerRow}", 'DVR-01 (REV. 5)');

                // ---- light styling ----
                $sheet->getStyle('B1')->getFont()->setBold(true)->setSize(16);
                $sheet->getStyle('J1')->getFont()->setBold(true)->setSize(12);
                $sheet->getStyle('J4:K4')->getFont()->setBold(true)->setSize(14);
                $sheet->getStyle('B6')->getFont()->setBold(true)->setUnderline(true);
                $sheet->getStyle('I6')->getFont()->setBold(true)->setUnderline(true);
                $sheet->getStyle('B8')->getFont()->setBold(true);
                $sheet->getStyle('I8')->getFont()->setBold(true);

                $headerRange = 'A21:M21';
                $sheet->getStyle($headerRange)->getFont()->setBold(true)->getColor()->setRGB('FFFFFF');
                $sheet->getStyle($headerRange)->getFill()
                    ->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('8B1E1E');
                $sheet->getStyle($headerRange)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

                $lastItemRow = 21 + max($do->items->count(), 1);
                $dataRange = "A22:M{$lastItemRow}";
                $sheet->getStyle($dataRange)->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
                $sheet->getStyle($dataRange)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

                $totalRange = "A{$totalRow}:J{$totalRow}";
                $sheet->getStyle($totalRange)->getFont()->setBold(true);
                $sheet->getStyle($totalRange)->getFill()
                    ->setFillType(Fill::FILL_SOLID)->getStartColor()->setRGB('F6E9E9');

                foreach (range('A', 'M') as $col) {
                    $sheet->getColumnDimension($col)->setWidth(13);
                }
                $sheet->getColumnDimension('F')->setWidth(20);
                $sheet->getColumnDimension('L')->setWidth(14);
                $sheet->getColumnDimension('M')->setWidth(14);
            },
        ];
    }
}
