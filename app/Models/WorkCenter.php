<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WorkCenter extends Model
{
    use HasFactory;

    protected $fillable = [
        'code', 'name', 'area', 'target_per_hour', 'is_active', 'sort_order',
    ];

    protected $casts = [
        'target_per_hour' => 'integer',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function hourlyOutputs(): HasMany
    {
        return $this->hasMany(HourlyOutput::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
