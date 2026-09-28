<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreDeliveryOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'transaction_id' => ['required', 'integer', 'exists:fglist_data_sources,transaction_id'],
            'do_no' => ['nullable', 'string', 'max:50'],
            'order_date' => ['required', 'date'],
            'po_no' => ['nullable', 'string', 'max:100'],
            'terms' => ['nullable', 'string', 'max:100'],

            'bill_to_name' => ['required', 'string', 'max:150'],
            'bill_to_address' => ['nullable', 'string'],
            'attn_bill' => ['nullable', 'string', 'max:50'],

            'ship_to_name' => ['required', 'string', 'max:150'],
            'ship_to_address' => ['nullable', 'string'],
            'attn_ship' => ['nullable', 'string', 'max:50'],

            'vat_rate' => ['nullable', 'numeric', 'min:0', 'max:1'],
            'currency' => ['nullable', 'string', 'size:3'],

            // Unit prices keyed by fglist_data_source_id, e.g. {"prices": {"123": 4.5, "124": 12.75}}
            // Any lot not listed here defaults to unit_price 0.
            'prices' => ['nullable', 'array'],
            'prices.*' => ['numeric', 'min:0'],
        ];
    }
}
