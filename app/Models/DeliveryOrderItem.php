<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DeliveryOrderItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'delivery_order_id',
        'qc_scan_id',
        'lot_no',
        'device_no',
        'packaging',
        'qty',
        'remarks',
        'sort_order',
    ];

    protected $casts = [
        'qty' => 'integer',
    ];

    public function deliveryOrder()
    {
        return $this->belongsTo(DeliveryOrder::class);
    }

    public function scan()
    {
        return $this->belongsTo(QcScan::class, 'qc_scan_id');
    }
}
