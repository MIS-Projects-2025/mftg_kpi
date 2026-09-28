<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreHourlyOutputRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'work_center_id' => ['required', 'integer', 'exists:work_centers,id'],
            'hour_start' => ['required', 'date'],
            'shift' => ['required', 'in:1st,2nd,3rd'],
            'target_qty' => ['required', 'integer', 'min:0'],
            'actual_qty' => ['required', 'integer', 'min:0'],
            'reject_qty' => ['nullable', 'integer', 'min:0'],
            'downtime_minutes' => ['nullable', 'integer', 'min:0', 'max:60'],
            'downtime_reason' => ['nullable', 'string', 'max:255'],
            'operator_name' => ['nullable', 'string', 'max:100'],
            'remarks' => ['nullable', 'string', 'max:255'],
        ];
    }
}
