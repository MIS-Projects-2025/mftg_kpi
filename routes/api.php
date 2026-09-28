<?php

use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DeliveryOrderController;
use App\Http\Controllers\Api\HourlyOutputController;
use App\Http\Controllers\Api\PackageListController;
use App\Http\Controllers\Api\LotCommitController;
use App\Http\Controllers\Api\TelfordOutController;
use App\Http\Controllers\Api\TeamDashboardController;
use App\Http\Controllers\Api\LoadingPlanController;
use App\Http\Controllers\Api\LotMonitoringController;
use App\Http\Controllers\Api\LoadingPlanWipController;
use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\F3OutController;
use Illuminate\Support\Facades\Route;

Route::prefix('fglist')->group(function () {
    Route::post('import', [DeliveryOrderController::class, 'import']);
    Route::get('transactions', [DeliveryOrderController::class, 'transactions']);
    Route::get('transactions/{transactionId}/items', [DeliveryOrderController::class, 'itemsForTransaction']);
});

Route::prefix('delivery-orders')->group(function () {
    Route::get('/', [DeliveryOrderController::class, 'index']);
    Route::post('/', [DeliveryOrderController::class, 'store']);
    Route::get('{deliveryOrder}', [DeliveryOrderController::class, 'show']);
    Route::get('{deliveryOrder}/export', [DeliveryOrderController::class, 'export']);
});

Route::prefix('dashboard')->group(function () {
    Route::get('summary',      [DashboardController::class, 'summary']);
    Route::get('per-hour',     [DashboardController::class, 'perHour']);
    Route::get('per-shift',    [DashboardController::class, 'perShift']);
    Route::get('per-day',      [DashboardController::class, 'perDay']);
    Route::get('per-partname', [DashboardController::class, 'perPartname']);
    Route::get('areas',        [DashboardController::class, 'areas']);
    Route::get('work-centers', [DashboardController::class, 'workCenters']);
});

Route::get('work-centers', [DashboardController::class, 'listWorkCenters']);

Route::get('hourly-outputs/check-lot', [HourlyOutputController::class, 'checkLot']);

Route::get('lot-commits', [LotCommitController::class, 'index']);

Route::prefix('hourly-outputs')->group(function () {
    Route::get('/', [HourlyOutputController::class, 'index']);
    Route::post('/', [HourlyOutputController::class, 'store']);
    Route::delete('{hourlyOutput}', [HourlyOutputController::class, 'destroy']);

});

Route::get('telford-out',          [TelfordOutController::class, 'index']);
Route::post('telford-out/upload',  [TelfordOutController::class, 'upload']);

Route::get('f3-out', [F3OutController::class, 'index']);
Route::post('f3-out/upload', [F3OutController::class, 'upload']);

Route::get(
    'package-list/search',
    [PackageListController::class, 'search']
);

Route::prefix('team-dashboard')->group(function () {
    Route::get('teams',          [TeamDashboardController::class, 'teams']);
    Route::get('factories',      [TeamDashboardController::class, 'factories']);  // ← new
    Route::get('areas',          [TeamDashboardController::class, 'areas']);      // ← new
    Route::get('per-day',        [TeamDashboardController::class, 'perDay']);
    Route::get('lot-progress',   [TeamDashboardController::class, 'lotProgress']);
    Route::get('current-period', [TeamDashboardController::class, 'currentPeriod']);
    Route::get('periods',        [TeamDashboardController::class, 'periods']);
});
// Wrap in auth:sanctum if you want to require login and capture scanned_by / prepared_by.
Route::middleware(['auth:sanctum'])->group(function () {
    // Route::get('/qc-scans', [QcScanController::class, 'index']);
    // Route::post('/qc-scans', [QcScanController::class, 'store']);
    // Route::get('/qc-scans/{qcScan}', [QcScanController::class, 'show']);
    // Route::delete('/qc-scans/{qcScan}', [QcScanController::class, 'destroy']);
    // Route::get('/qc-scans/lot/{lotNo}/summary', [QcScanController::class, 'lotSummary']);
    // Route::get('/qc-scans/lot/{lotNo}/groups', [QcScanController::class, 'lotGroups']);

    Route::get('/delivery-orders', [DeliveryOrderController::class, 'index']);
    Route::post('/delivery-orders', [DeliveryOrderController::class, 'store']);
    Route::get('/delivery-orders/{deliveryOrder}', [DeliveryOrderController::class, 'show']);
    Route::delete('/delivery-orders/{deliveryOrder}', [DeliveryOrderController::class, 'destroy']);
    Route::get('/delivery-orders/{deliveryOrder}/pdf', [DeliveryOrderController::class, 'pdf']);
});

Route::prefix('loading-plan')->group(function () {
    Route::get('data',    [LoadingPlanController::class, 'data']);
    Route::get('summary', [LoadingPlanController::class, 'summary']);
    Route::post('upload', [LoadingPlanController::class, 'upload']);
});

Route::prefix('lot-monitoring')->group(function () {
    Route::get('lots',  [LotMonitoringController::class, 'lots']);
    Route::get('dates', [LotMonitoringController::class, 'dates']);
});

Route::get('loading-plan/wip-summary', [LoadingPlanWipController::class, 'summary']);

Route::prefix('attendance')->group(function () {
    Route::get('summary',              [AttendanceController::class, 'summary']);
    Route::get('employees',            [AttendanceController::class, 'employees']);
    Route::get('dates',                [AttendanceController::class, 'dates']);
    Route::get('breakdown',            [AttendanceController::class, 'breakdown']);
    Route::get('breakdown-employees',  [AttendanceController::class, 'breakdownEmployees']);
});



