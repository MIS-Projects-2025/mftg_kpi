<?php

namespace App\Exports;

use App\Models\DeliveryOrder;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class DeliveryOrderExport implements WithMultipleSheets
{
    public function __construct(private DeliveryOrder $deliveryOrder) {}

    public function sheets(): array
    {
        return [
            new DeliveryOrderSheet($this->deliveryOrder),
            new FglistSourceSheet($this->deliveryOrder),
        ];
    }
}
