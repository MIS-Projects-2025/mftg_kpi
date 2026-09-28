<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FglistDataSource extends Model
{
    use HasFactory;

    protected $fillable = [
        'transaction_id',
        'rto_non_rto',
        'destination',
        'focus_group',
        'lotno',
        'quantity',
        'partname',
        'datecode',
        'lead',
        'package',
        'total_box',
        'lot_type',
        'transaction_date',
    ];

    protected $casts = [
        'transaction_id' => 'integer',
        'quantity' => 'integer',
        'lead' => 'integer',
        'total_box' => 'integer',
        'transaction_date' => 'datetime',
    ];

    public function scopeForTransaction($query, $transactionId)
    {
        return $query->where('transaction_id', $transactionId);
    }
}
