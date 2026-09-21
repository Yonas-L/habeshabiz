<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Debt;
use App\Models\Expense;
use App\Models\FinancialAccount;
use App\Models\InventoryStock;
use App\Models\InventoryUnit;
use App\Models\SalesOrder;
use App\Models\SalesOrderItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function summary(Request $request): JsonResponse
    {
        // 1. Inventory Valuation
        $serializedStockValue = (float) InventoryUnit::where('status', 'in_stock')->sum('cost_basis');
        $quantityStockValue = (float) InventoryStock::whereHas('variant.product', fn ($q) => $q->where('has_serials', false))
            ->whereDoesntHave('variant.inventoryUnits', fn ($q) => $q->where('status', 'in_stock'))
            ->get()
            ->sum(fn ($s) => $s->quantity_on_hand * (float) $s->average_cost);
        $totalStockValue = $serializedStockValue + $quantityStockValue;

        // 2. Debts: Receivables vs Payables
        $totalReceivables = (float) Debt::where('type', 'receivable')
            ->whereIn('status', ['open', 'partially_paid'])
            ->sum('remaining_amount');

        $totalPayables = (float) Debt::where('type', 'payable')
            ->whereIn('status', ['open', 'partially_paid'])
            ->sum('remaining_amount');

        // 3. Treasury Balances
        $cashAndBankBalance = (float) FinancialAccount::where('is_custom_asset', false)->sum('current_balance');
        $customAssetsBalance = (float) FinancialAccount::where('is_custom_asset', true)->sum('current_balance');

        // 4. Net Capital (The Ethiopian Merchant Formula from Excel)
        // Net Capital = Stock + Receivables + Cash/Banks + Assets - Payables
        $netCapital = $totalStockValue + $totalReceivables + $cashAndBankBalance + $customAssetsBalance - $totalPayables;

        // 5. Monthly Performance (Current Calendar Month)
        $startOfMonth = now()->startOfMonth();
        $monthlyRevenue = (float) SalesOrder::where('order_date', '>=', $startOfMonth)->sum('total_amount');
        $monthlyDiscounts = (float) SalesOrder::where('order_date', '>=', $startOfMonth)->sum('discount_amount');
        $itemProfits = (float) SalesOrderItem::whereHas('salesOrder', function ($q) use ($startOfMonth) {
            $q->where('order_date', '>=', $startOfMonth);
        })->sum('profit');
        $monthlyGrossProfit = max(0.0, $itemProfits - $monthlyDiscounts);

        $monthlyExpenses = (float) Expense::where('date', '>=', $startOfMonth)
            ->where('is_owner_draw', false)
            ->sum('amount');

        $monthlyOwnerDraws = (float) Expense::where('date', '>=', $startOfMonth)
            ->where('is_owner_draw', true)
            ->sum('amount');

        $monthlyNetProfit = $monthlyGrossProfit - $monthlyExpenses;

        // 6. Recent Sales Orders
        $recentSales = SalesOrder::with(['customer', 'salesperson', 'items.variant.product'])
            ->latest('order_date')
            ->take(5)
            ->get();

        // 7. Top Receivables (Who owes the shop money)
        $topReceivables = Debt::with('contact')
            ->where('type', 'receivable')
            ->whereIn('status', ['open', 'partially_paid'])
            ->orderByDesc('remaining_amount')
            ->take(5)
            ->get();

        // 8. Top Payables (Who does the shop owe money to)
        $topPayables = Debt::with('contact')
            ->where('type', 'payable')
            ->whereIn('status', ['open', 'partially_paid'])
            ->orderByDesc('remaining_amount')
            ->take(5)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'capital_overview' => [
                    'net_capital' => $netCapital,
                    'stock_value' => $totalStockValue,
                    'receivables' => $totalReceivables,
                    'cash_and_banks' => $cashAndBankBalance,
                    'custom_assets' => $customAssetsBalance,
                    'payables' => $totalPayables,
                ],
                'monthly_performance' => [
                    'revenue' => $monthlyRevenue,
                    'gross_profit' => $monthlyGrossProfit,
                    'operating_expenses' => $monthlyExpenses,
                    'owner_draws' => $monthlyOwnerDraws,
                    'net_profit' => $monthlyNetProfit,
                ],
                'counts' => [
                    'in_stock_phones' => InventoryUnit::where('status', 'in_stock')->count(),
                    'open_receivables' => Debt::where('type', 'receivable')->whereIn('status', ['open', 'partially_paid'])->count(),
                    'open_payables' => Debt::where('type', 'payable')->whereIn('status', ['open', 'partially_paid'])->count(),
                ],
                'recent_sales' => $recentSales,
                'top_receivables' => $topReceivables,
                'top_payables' => $topPayables,
            ],
        ]);
    }
}
