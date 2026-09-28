<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DeliveryOrder;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class DeliveryOrderController extends Controller
{
    public function index(Request $request)
    {
        $query = DeliveryOrder::query()->withCount('items')->latest();

        if ($request->filled('customer_name')) {
            $query->where('customer_name', 'like', '%'.$request->string('customer_name').'%');
        }
        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        return $query->paginate($request->integer('per_page', 20));
    }

    public function store(Request $request)
    {
        $validated = Validator::make($request->all(), [
            'customer_name' => ['required', 'string', 'max:150'],
            'customer_address' => ['nullable', 'string'],
            'delivery_date' => ['required', 'date'],
            'vehicle_no' => ['nullable', 'string', 'max:50'],
            'driver_name' => ['nullable', 'string', 'max:100'],
            'remarks' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.qc_scan_id' => ['nullable', 'integer', 'exists:qc_scans,id'],
            'items.*.lot_no' => ['required', 'string', 'max:100'],
            'items.*.device_no' => ['required', 'string', 'max:100'],
            'items.*.packaging' => ['required', 'string', 'max:100'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
            'items.*.remarks' => ['nullable', 'string', 'max:255'],
        ])->validate();

        $deliveryOrder = DB::transaction(function () use ($validated, $request) {
            $do = DeliveryOrder::create([
                'do_no' => DeliveryOrder::nextDoNumber(),
                'customer_name' => $validated['customer_name'],
                'customer_address' => $validated['customer_address'] ?? null,
                'delivery_date' => $validated['delivery_date'],
                'vehicle_no' => $validated['vehicle_no'] ?? null,
                'driver_name' => $validated['driver_name'] ?? null,
                'remarks' => $validated['remarks'] ?? null,
                'status' => 'issued',
                'prepared_by' => $request->user()?->id,
            ]);

            foreach ($validated['items'] as $index => $item) {
                $do->items()->create([
                    'qc_scan_id' => $item['qc_scan_id'] ?? null,
                    'lot_no' => $item['lot_no'],
                    'device_no' => $item['device_no'],
                    'packaging' => $item['packaging'],
                    'qty' => $item['qty'],
                    'remarks' => $item['remarks'] ?? null,
                    'sort_order' => $index,
                ]);
            }

            return $do;
        });

        return response()->json($deliveryOrder->load('items'), 201);
    }

    public function show(DeliveryOrder $deliveryOrder)
    {
        return $deliveryOrder->load(['items', 'preparer']);
    }

    public function destroy(DeliveryOrder $deliveryOrder)
    {
        $deliveryOrder->update(['status' => 'cancelled']);

        return response()->json(['message' => 'Delivery order cancelled.']);
    }

    /**
     * Stream the Delivery Order as a PDF. `?download=1` forces a download
     * instead of opening inline (inline lets the browser's print dialog
     * handle "print to PDF" / physical printing directly).
     */
    public function pdf(Request $request, DeliveryOrder $deliveryOrder)
    {
        $deliveryOrder->load(['items', 'preparer']);

        $pdf = Pdf::loadView('pdf.delivery_order', ['deliveryOrder' => $deliveryOrder])
            ->setPaper('a4', 'portrait');

        $filename = $deliveryOrder->do_no.'.pdf';

        return $request->boolean('download')
            ? $pdf->download($filename)
            : $pdf->stream($filename);
    }
}
