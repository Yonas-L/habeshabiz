<?php

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DebtController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\OnboardingController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\SaleController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\StaffController;
use App\Http\Controllers\Api\TaskController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // Public Endpoints
    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::post('/onboard', [OnboardingController::class, 'onboard']);
    Route::get('/public/statement/{token}', [ContactController::class, 'publicStatement']);

    // Protected Routes
    Route::middleware('auth:sanctum')->group(function () {
        // Business Settings & Profile (Owner Only)
        Route::get('/settings/profile', [SettingsController::class, 'getProfile']);
        Route::put('/settings/profile', [SettingsController::class, 'updateProfile']);
        Route::post('/settings/profile/logo', [SettingsController::class, 'uploadLogo']);

        // User Profile & Session
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::post('/auth/change-password', [AuthController::class, 'changePassword']);
        Route::put('/auth/profile', [AuthController::class, 'updateProfile']);

        // Staff Management & Audit (Owner Only / Leaderboard for all)
        Route::get('/staff', [StaffController::class, 'index']);
        Route::post('/staff', [StaffController::class, 'store']);
        Route::patch('/staff/{id}/toggle-status', [StaffController::class, 'toggleStatus']);
        Route::post('/staff/{id}/reset-password', [StaffController::class, 'resetPassword']);
        Route::get('/staff/leaderboard', [StaffController::class, 'leaderboard']);
        Route::get('/audit-logs', [AuditLogController::class, 'index']);
        Route::get('/staff/audit-logs', [AuditLogController::class, 'index']);

        // Personal Staff Tasks & Targets Checklist
        Route::get('/tasks', [TaskController::class, 'index']);
        Route::post('/tasks', [TaskController::class, 'store']);
        Route::patch('/tasks/{id}/toggle', [TaskController::class, 'toggle']);
        Route::delete('/tasks/{id}', [TaskController::class, 'destroy']);

        // Dashboard & Capital Formula Overview
        Route::get('/dashboard/summary', [DashboardController::class, 'summary']);

        // Categories & Taxonomy
        Route::get('/categories', [CategoryController::class, 'index']);
        Route::post('/categories', [CategoryController::class, 'store']);
        Route::put('/categories/{id}', [CategoryController::class, 'update']);
        Route::delete('/categories/{id}', [CategoryController::class, 'destroy']);

        // Catalog & Products
        Route::get('/products', [ProductController::class, 'index']);
        Route::post('/products', [ProductController::class, 'store']);
        Route::put('/products/{id}', [ProductController::class, 'update']);
        Route::delete('/products/{id}', [ProductController::class, 'destroy']);
        Route::post('/products/{id}/variants', [ProductController::class, 'addVariant']);
        Route::put('/variants/{id}', [ProductController::class, 'updateVariant']);
        Route::delete('/variants/{id}', [ProductController::class, 'destroyVariant']);

        // Serialized & Quantity Inventory
        Route::get('/inventory/units', [InventoryController::class, 'units']);
        Route::post('/inventory/units', [InventoryController::class, 'intakeUnit']);
        Route::put('/inventory/units/{id}', [InventoryController::class, 'updateUnit']);
        Route::post('/inventory/units/{id}/handover', [InventoryController::class, 'handoverUnit']);
        Route::post('/inventory/units/{id}/mark-handover-sold', [InventoryController::class, 'markHandoverSold']);
        Route::post('/inventory/units/{id}/restock', [InventoryController::class, 'restockUnit']);
        Route::post('/inventory/units/{id}/customer-return', [InventoryController::class, 'customerReturn']);
        Route::post('/inventory/units/{id}/swap', [InventoryController::class, 'swapUnit']);
        Route::post('/inventory/units/{id}/return-to-vendor', [InventoryController::class, 'returnToVendor']);
        Route::post('/inventory/units/{id}/receive-from-vendor', [InventoryController::class, 'receiveFromVendor']);
        Route::post('/inventory/units/{id}/vendor-swap', [InventoryController::class, 'vendorSwap']);
        Route::post('/inventory/units/{id}/repaired-restock', [InventoryController::class, 'repairAndRestock']);
        Route::get('/inventory/stock-summary', [InventoryController::class, 'stockSummary']);

        // Sales & Brokered Sourcing
        Route::get('/sales', [SaleController::class, 'index']);
        Route::post('/sales', [SaleController::class, 'store']);
        Route::post('/sales/{id}/collect', [SaleController::class, 'collectPayment']);

        // Debts: Receivables & Payables Ledger
        Route::get('/debts', [DebtController::class, 'index']);
        Route::post('/debts', [DebtController::class, 'store']);
        Route::put('/debts/{id}', [DebtController::class, 'update']);
        Route::delete('/debts/{id}', [DebtController::class, 'destroy']);
        Route::post('/debts/{id}/payments', [DebtController::class, 'settlePayment']);

        // Financial Treasury Accounts & Transfers
        Route::get('/accounts', [AccountController::class, 'index']);
        Route::post('/accounts', [AccountController::class, 'store']);
        Route::get('/accounts/{id}/activities', [AccountController::class, 'activities']);
        Route::put('/accounts/{id}', [AccountController::class, 'update']);
        Route::delete('/accounts/{id}', [AccountController::class, 'destroy']);
        Route::post('/accounts/transfer', [AccountController::class, 'transfer']);

        // Contacts & People Directory (Partners, Brokers, Suppliers, Customers)
        Route::get('/contacts', [ContactController::class, 'index']);
        Route::post('/contacts', [ContactController::class, 'store']);
        Route::get('/contacts/{id}', [ContactController::class, 'show']);
        Route::put('/contacts/{id}', [ContactController::class, 'update']);
        Route::delete('/contacts/{id}', [ContactController::class, 'destroy']);
        Route::get('/contacts/{id}/statement', [ContactController::class, 'statement']);

        // Operational Expenses & Owner Draws
        Route::get('/expenses', [ExpenseController::class, 'index']);
        Route::post('/expenses', [ExpenseController::class, 'store']);
    });
});
