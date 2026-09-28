<?php

namespace App\Http\Controllers\Api;

use App\Exports\DeliveryOrderExport;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDeliveryOrderRequest;
use App\Imports\FglistDataSourceImport;
use App\Models\DeliveryOrder;
use App\Models\FglistDataSource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Facades\Excel;

class DeliveryOrderController extends Controller
{
    /**
     * POST /api/fglist/import
     * Uploads an FGLIST workbook (.xlsx/.xls), reads its first sheet
     * ("FGLIST-DATA SOURCE") and upserts every lot row into the DB. Existing
     * rows for the same transaction_id + lotno are updated, not duplicated,
     * so the same file can safely be re-uploaded.
     */
    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls', 'max:10240'],
        ]);

        $import = new FglistDataSourceImport;
        Excel::import($import, $request->file('file'));

        $transactionIds = FglistDataSource::query()
            ->select('transaction_id')
            ->distinct()
            ->pluck('transaction_id');

        return response()->json([
            'message' => "Imported {$import->imported} lot rows ({$import->skipped} skipped).",
            'imported' => $import->imported,
            'skipped' => $import->skipped,
            'transaction_ids' => $transactionIds,
        ]);
    }

    /**
     * GET /api/fglist/transactions
     * Distinct transaction ids available in the FGLIST data source (the "DB"),
     * with a lot count / unit total so the picker can show useful context.
     */
    public function transactions(): JsonResponse
    {
        $transactions = FglistDataSource::query()
            ->select('transaction_id')
            ->selectRaw('COUNT(*) as lot_count')
            ->selectRaw('SUM(quantity) as total_units')
            ->selectRaw('SUM(total_box) as total_boxes')
            ->selectRaw('MAX(transaction_date) as latest_transaction_date')
            ->groupBy('transaction_id')
            ->orderByDesc('latest_transaction_date')
            ->get();

        return response()->json($transactions);
    }

    /**
     * GET /api/fglist/transactions/{transactionId}/items
     * Raw lot rows for a given transaction, used to populate the preview table.
     */
    public function itemsForTransaction(int $transactionId): JsonResponse
    {
        $items = FglistDataSource::forTransaction($transactionId)->orderBy('id')->get();

        abort_if($items->isEmpty(), 404, 'No FGLIST rows found for that transaction ID.');

        return response()->json($items);
    }

    /**
     * GET /api/delivery-orders
     * Previously issued delivery orders (most recent first).
     */
    public function index(): JsonResponse
    {
        $orders = DeliveryOrder::withCount('items')
            ->latest()
            ->paginate(15);

        return response()->json($orders);
    }

    /**
     * GET /api/delivery-orders/{deliveryOrder}
     */
    public function show(DeliveryOrder $deliveryOrder): JsonResponse
    {
        return response()->json($deliveryOrder->load('items'));
    }

    /**
     * POST /api/delivery-orders
     * Creates a Delivery Order snapshot from the current FGLIST rows for the
     * chosen transaction and persists it (header + line items) in the DB.
     */
    public function store(StoreDeliveryOrderRequest $request): JsonResponse
    {
        $data = $request->validated();

        $sourceRows = FglistDataSource::forTransaction($data['transaction_id'])->get();

        abort_if($sourceRows->isEmpty(), 422, 'No FGLIST rows found for that transaction ID.');

        $prices = $data['prices'] ?? [];
        $vatRate = $data['vat_rate'] ?? 0.12;

        $deliveryOrder = DB::transaction(function () use ($data, $sourceRows, $prices, $vatRate) {
            // Format is invoice-style (unit price, amount, subtotal, VAT, total
            // due) but the document itself stays a Delivery Order — same name,
            // same transaction, just priced.
            $lineItems = $sourceRows->map(function (FglistDataSource $row) use ($prices) {
                $unitPrice = (float) ($prices[$row->id] ?? 0);
                $amount = round($row->quantity * $unitPrice, 2);

                return [
                    'fglist_data_source_id' => $row->id,
                    'rto_non_rto' => $row->rto_non_rto,
                    'destination' => $row->destination,
                    'focus_group' => $row->focus_group,
                    'lotno' => $row->lotno,
                    'quantity' => $row->quantity,
                    'unit_price' => $unitPrice,
                    'amount' => $amount,
                    'partname' => $row->partname,
                    'datecode' => $row->datecode,
                    'lead' => $row->lead,
                    'package' => $row->package,
                    'total_box' => $row->total_box,
                    'lot_type' => $row->lot_type,
                ];
            });

            $subtotal = round($lineItems->sum('amount'), 2);
            $vatAmount = round($subtotal * $vatRate, 2);
            $totalAmount = round($subtotal + $vatAmount, 2);

            $order = DeliveryOrder::create([
                'do_no' => $data['do_no'] ?? null,
                'transaction_id' => $data['transaction_id'],
                'order_date' => $data['order_date'],
                'po_no' => $data['po_no'] ?? null,
                'terms' => $data['terms'] ?? '30 DAYS',
                'bill_to_name' => $data['bill_to_name'],
                'bill_to_address' => $data['bill_to_address'] ?? null,
                'attn_bill' => $data['attn_bill'] ?? null,
                'ship_to_name' => $data['ship_to_name'],
                'ship_to_address' => $data['ship_to_address'] ?? null,
                'attn_ship' => $data['attn_ship'] ?? null,
                'total_units' => $sourceRows->sum('quantity'),
                'total_boxes' => $sourceRows->sum('total_box'),
                'status' => 'issued',
                'currency' => $data['currency'] ?? 'PHP',
                'subtotal' => $subtotal,
                'vat_rate' => $vatRate,
                'vat_amount' => $vatAmount,
                'total_amount' => $totalAmount,
            ]);

            $order->items()->createMany($lineItems->toArray());

            return $order;
        });

        return response()->json($deliveryOrder->load('items'), 201);
    }

    /**
     * GET /api/delivery-orders/{deliveryOrder}/export
     * Streams the Delivery Order back out as an .xlsx matching the original
     * TELFORD DVR-01 layout (letterhead, BILL TO / SHIP TO, item table, G-TOTAL).
     */
    public function export(DeliveryOrder $deliveryOrder)
    {
        $deliveryOrder->load('items');

        $filename = sprintf(
            'Delivery_Order_%s_%s.xlsx',
            $deliveryOrder->transaction_id,
            $deliveryOrder->order_date->format('Y-m-d')
        );

        return Excel::download(new DeliveryOrderExport($deliveryOrder), $filename);
    }
}
