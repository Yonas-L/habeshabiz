<?php

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DebtController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\SaleController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // Public Authentication
    Route::post('/auth/login', [AuthController::class, 'login']);

    // Protected Routes
    Route::middleware('auth:sanctum')->group(function () {
        // User Profile & Session
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);

        // Dashboard & Capital Formula Overview
        Route::get('/dashboard/summary', [DashboardController::class, 'summary']);

        // Catalog & Products
        Route::get('/products', [ProductController::class, 'index']);
        Route::post('/products', [ProductController::class, 'store']);

        // Serialized & Quantity Inventory
        Route::get('/inventory/units', [InventoryController::class, 'units']);
        Route::post('/inventory/units', [InventoryController::class, 'intakeUnit']);
        Route::get('/inventory/stock-summary', [InventoryController::class, 'stockSummary']);

        // Sales & Brokered Sourcing
        Route::get('/sales', [SaleController::class, 'index']);
        Route::post('/sales', [SaleController::class, 'store']);

        // Debts: Receivables & Payables Ledger
        Route::get('/debts', [DebtController::class, 'index']);
        Route::post('/debts/{id}/payments', [DebtController::class, 'settlePayment']);

        // Financial Treasury Accounts & Transfers
        Route::get('/accounts', [AccountController::class, 'index']);
        Route::post('/accounts/transfer', [AccountController::class, 'transfer']);

        // Contacts & People Directory
        Route::get('/contacts', [ContactController::class, 'index']);
        Route::post('/contacts', [ContactController::class, 'store']);

        // Operational Expenses & Owner Draws
        Route::get('/expenses', [ExpenseController::class, 'index']);
        Route::post('/expenses', [ExpenseController::class, 'store']);
    });
});
