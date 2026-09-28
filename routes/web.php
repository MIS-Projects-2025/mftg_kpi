<?php

use Illuminate\Support\Facades\Route;

$app_name = env('APP_NAME', '');

Route::prefix($app_name)->group(function () {

    Route::get('/dashboard', function () {
        return view('dashboard.index');
    })->name('dashboard');

    Route::get('/delivery-orders/builder', function () {
        return view('delivery-orders.builder');
    })->name('delivery-orders.builder');

});
