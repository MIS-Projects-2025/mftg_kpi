<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\FGListController;
use App\Http\Controllers\General\AdminController;
use App\Http\Controllers\General\ProfileController;
use App\Http\Middleware\AdminMiddleware;
use App\Http\Middleware\AuthMiddleware;
use Illuminate\Support\Facades\Route;

$app_name = env('APP_NAME', '');

Route::redirect('/', "/$app_name");

Route::prefix($app_name)->middleware(AuthMiddleware::class)->group(function () {

    Route::middleware(AdminMiddleware::class)->group(function () {
        Route::get('/admin', [AdminController::class, 'index'])->name('admin');
        Route::get('/new-admin', [AdminController::class, 'index_addAdmin'])->name('index_addAdmin');
        Route::post('/add-admin', [AdminController::class, 'addAdmin'])->name('addAdmin');
        Route::post('/remove-admin', [AdminController::class, 'removeAdmin'])->name('removeAdmin');
        Route::patch('/change-admin-role', [AdminController::class, 'changeAdminRole'])->name('changeAdminRole');
    });

    Route::get("/", [DashboardController::class, 'index'])->name('dashboard');
    Route::get("/dashboard", [DashboardController::class, 'index'])->name('dashboard.kpi');

    Route::get('/profile', [ProfileController::class, 'index'])->name('profile.index');
    Route::post('/change-password', [ProfileController::class, 'changePassword'])->name('changePassword');
    Route::get('/fg-list', [FGListController::class, 'index'])->name('fglist');  // ← inside, correct
    // ✅ use full class path
    Route::get('/delivery-orders/builder', function () {
        return view('delivery-orders.builder');
    })->name('delivery-orders.builder');

    Route::get('/hourly-output', function () {
        return view('hourly.index');
    })->name('hourly-output');

    Route::get('/telford-out', function () {
        return view('telford-out.index');
    })->name('telford-out');

     Route::get('/f3-out', function () {
        return view('f3-out.index');
    })->name('f3-out');

    Route::get('/team-dashboard', function () {
        return view('team-dashboard.index');
    })->name('team-dashboard');

    Route::get('/loading-plan', function () {
        return view('loading-plan.index');
    })->name('loading-plan');

    Route::get('/lot-monitoring', function () {
        return view('lot-monitoring.index');
    })->name('lot-monitoring');

});
