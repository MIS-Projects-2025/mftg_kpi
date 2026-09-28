<?php

namespace App\Exports;

use App\Models\DeliveryOrder;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithTitle;

class FglistSourceSheet implements FromCollection, WithHeadings, WithTitle
{
    public function __construct(private DeliveryOrder $deliveryOrder) {}

    public function collection()
    {
        return $this->deliveryOrder->items->map(fn ($item) => [
            $this->deliveryOrder->transaction_id,
            $item->rto_non_rto,
            $item->destination,
            $item->focus_group,
            $item->lotno,
            $item->quantity,
            $item->unit_price,
            $item->amount,
            $item->partname,
            $item->datecode,
            $item->lead,
            $item->package,
            $item->total_box,
            $item->lot_type,
        ]);
    }

    public function headings(): array
    {
        return [
            'TransactionID', 'RTO/NON-RTO', 'Destination', 'FocusGroup', 'Lotno',
            'Quantity', 'UnitPrice', 'Amount', 'Partname', 'Datecode', 'Lead',
            'Package', 'TotalBox', 'LotType',
        ];
    }

    public function title(): string
    {
        return 'FGLIST-DATA SOURCE';
    }
}
