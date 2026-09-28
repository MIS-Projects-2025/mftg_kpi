<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DeliveryOrder extends Model
{
    use HasFactory;

    protected $fillable = [
        'do_no',
        'customer_name',
        'customer_address',
        'delivery_date',
        'vehicle_no',
        'driver_name',
        'remarks',
        'status',
        'prepared_by',
    ];

    protected $casts = [
        'delivery_date' => 'date',
    ];

    public function items()
    {
        return $this->hasMany(DeliveryOrderItem::class)->orderBy('sort_order');
    }

    public function preparer()
    {
        return $this->belongsTo(User::class, 'prepared_by');
    }

    public function getTotalQtyAttribute(): int
    {
        return $this->items->sum('qty');
    }

    /**
     * Generates a DO number like DO-20260716-001, scoped to the day.
     */
    public static function nextDoNumber(): string
    {
        $prefix = 'DO-'.now()->format('Ymd').'-';
        $lastSeq = static::where('do_no', 'like', $prefix.'%')
            ->orderByDesc('do_no')
            ->value('do_no');

        $nextSeq = $lastSeq ? ((int) substr($lastSeq, -3)) + 1 : 1;

        return $prefix.str_pad((string) $nextSeq, 3, '0', STR_PAD_LEFT);
    }
}
