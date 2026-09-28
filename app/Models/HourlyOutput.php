<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HourlyOutput extends Model
{
    protected $fillable = [
        'lot_no',
        'partname',
        'device_name',
        'package',
        'charging',
        'good_qty',
        'reject_qty',
        'operator_name',
        'shift',
        'hour',
    ];
}
