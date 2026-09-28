<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HourlyOutput;
use Illuminate\Http\Request;

class HourlyOutputController extends Controller
{
    /* ── GET /api/hourly-outputs ────────────────────────────────── */
    public function index(Request $request)
    {
        $query = HourlyOutput::query();

        if ($request->filled('date')) {
            $query->whereDate('created_at', $request->date);
        }
        if ($request->filled('shift')) {
            $query->where('shift', $request->shift);
        }

        return response()->json(
            $query->orderBy('created_at', 'desc')->get()
        );
    }

    /* ── POST /api/hourly-outputs ───────────────────────────────── */
    public function store(Request $request)
    {
    \Log::info('HourlyOutput store payload:', $request->all());    
    $validated = $request->validate([
            'lot_no' => 'required|string|max:100',
            'partname' => 'required|string|max:200',
            'device_name' => 'nullable|string|max:200',
            'package' => 'nullable|string|max:200',
            'charging' => 'nullable|string|max:200',
            'good_qty' => 'required|integer|min:0',
            'reject_qty' => 'nullable|integer|min:0',
            'operator_name' => 'nullable|string|max:200',
            'shift' => 'nullable|string|max:20',
            'hour' => 'nullable|string|max:10',
        ]);

        $exists = HourlyOutput::where('lot_no', strtoupper(trim($validated['lot_no'])))
            ->exists();

        if ($exists) {
            return response()->json([
                'message' => 'Lot No '.strtoupper(trim($validated['lot_no'])).' already exists in records.',
                'duplicate' => true,
            ], 422);
        }
        $validated['reject_qty'] = $validated['reject_qty'] ?? 0;
        $validated['operator_name'] = $validated['operator_name'] ?? auth()->user()?->name;
$validated['hour']          = $request->input('hour');
        $record = HourlyOutput::create($validated);

        return response()->json($record, 201);
    }

    /* ── GET /api/hourly-outputs/check-lot?lot_no=XXX ─────────────── */
    public function checkLot(Request $request)
    {
        $request->validate(['lot_no' => 'required|string']);

        $exists = HourlyOutput::where('lot_no', strtoupper(trim($request->lot_no)))
            ->exists();

        return response()->json([
            'duplicate' => $exists,
            'lot_no' => strtoupper(trim($request->lot_no)),
        ]);
    }

    /* ── DELETE /api/hourly-outputs/{id} ────────────────────────── */
    public function destroy(HourlyOutput $hourlyOutput)
    {
        $hourlyOutput->delete();

        return response()->json(['message' => 'Deleted.']);
    }
}
