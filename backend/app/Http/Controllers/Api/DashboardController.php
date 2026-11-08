<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\Debt;
use App\Models\Expense;
use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use App\Models\InventoryStock;
use App\Models\InventoryUnit;
use App\Models\SalesOrder;
use App\Models\SalesOrderItem;
use App\Services\AccountBalanceService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function summary(Request $request): JsonResponse
    {
        // 0. Time Horizon (selected month or current calendar month)
        $monthParam = $request->query('month'); // e.g. "2025-12"
        if ($monthParam && preg_match('/^\d{4}-\d{2}$/', $monthParam)) {
            $startOfMonth = Carbon::createFromFormat('Y-m', $monthParam)->startOfMonth();
            $endOfMonth = $startOfMonth->copy()->endOfMonth();
        } else {
            $startOfMonth = now()->startOfMonth();
            $endOfMonth = now()->endOfMonth();
        }

        $range = strtolower((string) $request->query('range', '1m'));
        if (! in_array($range, ['1m', '3m', '6m', '1y'])) {
            $range = '1m';
        }

        if ($range === '3m') {
            $startOfPerformance = $startOfMonth->copy()->subMonths(2)->startOfMonth();
            $priorEnd = $startOfPerformance->copy()->subDay()->endOfDay();
            $priorStart = $startOfPerformance->copy()->subMonths(3)->startOfMonth();
            $comparisonLabel = 'vs prior 3 months';
        } elseif ($range === '6m') {
            $startOfPerformance = $startOfMonth->copy()->subMonths(5)->startOfMonth();
            $priorEnd = $startOfPerformance->copy()->subDay()->endOfDay();
            $priorStart = $startOfPerformance->copy()->subMonths(6)->startOfMonth();
            $comparisonLabel = 'vs prior 6 months';
        } elseif ($range === '1y') {
            $startOfPerformance = $startOfMonth->copy()->subMonths(11)->startOfMonth();
            $priorEnd = $startOfPerformance->copy()->subDay()->endOfDay();
            $priorStart = $startOfPerformance->copy()->subYear()->startOfMonth();
            $comparisonLabel = 'vs prior year';
        } else {
            $startOfPerformance = $startOfMonth->copy();
            $priorStart = $startOfMonth->copy()->subMonthNoOverflow()->startOfMonth();
            $priorEnd = $startOfMonth->copy()->subMonthNoOverflow()->endOfMonth();
            $comparisonLabel = 'vs last month';
        }

        // 1. Inventory Valuation (up to end of selected period)
        // Shop-owned serialized stock (purchased with shop capital or customer trade-ins)
        $shopOwnedSerializedStockValue = (float) InventoryUnit::where('created_at', '<=', $endOfMonth)
            ->where('status', 'in_stock')
            ->whereIn('source_type', ['purchase', 'exchange'])
            ->sum('cost_basis');

        // Vendor consignment stock physically on shelf
        $vendorConsignmentStockValue = (float) InventoryUnit::where('created_at', '<=', $endOfMonth)
            ->where('status', 'in_stock')
            ->where('source_type', 'consignment')
            ->sum('cost_basis');

        $quantityStockValue = (float) InventoryStock::whereHas('variant.product', fn ($q) => $q->where('has_serials', false))
            ->whereDoesntHave('variant.inventoryUnits', fn ($q) => $q->where('status', 'in_stock'))
            ->get()
            ->sum(fn ($s) => $s->quantity_on_hand * (float) $s->average_cost);

        // Dashboard Stock Valuation strictly reflects Shop-Owned stock
        $totalStockValue = $shopOwnedSerializedStockValue + $quantityStockValue;
        $totalShelfStockValue = $totalStockValue + $vendorConsignmentStockValue;

        // 2. Debts: Receivables vs Payables
        // Gross totals reflect the actual outstanding legal debt obligations.
        // Bilateral net calculations reflect the merchant netted position per partner.
        // Staff bonuses are kept completely distinct and never netted against vendor/custody debts.
        $openDebts = Debt::where('created_at', '<=', $endOfMonth)
            ->whereIn('status', ['open', 'partially_paid'])
            ->where('reference_type', '!=', 'salesperson_bonus')
            ->get();

        $grossReceivables = (float) $openDebts->where('type', 'receivable')->sum('remaining_amount');
        $grossPayables = (float) $openDebts->where('type', 'payable')->sum('remaining_amount');

        $debtsByContact = $openDebts->groupBy('contact_id');

        $totalReceivablesNetted = 0.0;
        $totalPayablesNetted = 0.0;
        $netReceivableParties = 0;
        $netPayableParties = 0;
        $netReceivableContactIds = [];
        $netPayableContactIds = [];

        foreach ($debtsByContact as $contactId => $contactDebts) {
            $contactRec = (float) $contactDebts->where('type', 'receivable')->sum('remaining_amount');
            $contactPay = (float) $contactDebts->where('type', 'payable')->sum('remaining_amount');
            $bilateralNet = $contactRec - $contactPay;

            if ($bilateralNet > 0.009) {
                $totalReceivablesNetted += $bilateralNet;
                $netReceivableParties++;
                $netReceivableContactIds[] = $contactId;
            } elseif ($bilateralNet < -0.009) {
                $totalPayablesNetted += abs($bilateralNet);
                $netPayableParties++;
                $netPayableContactIds[] = $contactId;
            }
            // net ≈ 0 → this contact contributes nothing to either side
        }

        // Staff bonuses are distinct payables owed by the shop to staff
        $uncollectedStaffBonuses = (float) Debt::where('created_at', '<=', $endOfMonth)
            ->where('type', 'payable')
            ->where('reference_type', 'salesperson_bonus')
            ->whereIn('status', ['open', 'partially_paid'])
            ->sum('remaining_amount');

        $pendingBonusStaffContactIds = Debt::where('created_at', '<=', $endOfMonth)
            ->where('type', 'payable')
            ->where('reference_type', 'salesperson_bonus')
            ->whereIn('status', ['open', 'partially_paid'])
            ->pluck('contact_id')
            ->filter()
            ->unique()
            ->values()
            ->all();

        $pendingBonusStaffCount = count($pendingBonusStaffContactIds);

        // Include uncollected staff bonuses in total payables
        $totalPayablesNetted += $uncollectedStaffBonuses;
        $grossPayables += $uncollectedStaffBonuses;

        // 3. Treasury & Asset Balances (calculated as of end of selected month)
        $accounts = FinancialAccount::where('created_at', '<=', $endOfMonth)->get();
        (new AccountBalanceService)->calculateBalancesAsOf($accounts, $endOfMonth);

        $cashAndBankBalance = 0.0;
        $forexBalance = 0.0;
        $goldBalance = 0.0;
        $otherAssetsBalance = 0.0;
        $customAssetsBalance = 0.0;

        foreach ($accounts as $acc) {
            $bal = (float) $acc->current_balance;
            if (! $acc->is_custom_asset) {
                $cashAndBankBalance += $bal;
            } else {
                $customAssetsBalance += $bal;
                $type = strtolower((string) $acc->type);
                $name = strtolower((string) $acc->name);
                if (str_contains($type, 'gold') || str_contains($name, 'gold')) {
                    $goldBalance += $bal;
                } elseif (str_contains($type, 'fx') || str_contains($type, 'currency') || str_contains($name, 'forex') || str_contains($name, 'usdt') || str_contains($name, 'usd')) {
                    $forexBalance += $bal;
                } else {
                    $otherAssetsBalance += $bal;
                }
            }
        }

        // 4. Net Capital (The Ethiopian Merchant Formula from Excel)
        // Net Capital = Owned Stock + Consignment Stock (covering consignment debt) + Receivables + Cash/Banks + Assets - Payables
        $netCapital = $totalStockValue + $vendorConsignmentStockValue + $totalReceivablesNetted + $cashAndBankBalance + $customAssetsBalance - $totalPayablesNetted;

        // 5. Monthly / Period Performance (selected range: 1m, 3m, 6m, 1y)

        $monthlyRevenue = (float) SalesOrder::whereBetween('order_date', [$startOfPerformance, $endOfMonth])
            ->whereNotIn('payment_status', ['refunded', 'cancelled'])
            ->sum('total_amount');
        $monthlyDiscounts = (float) SalesOrder::whereBetween('order_date', [$startOfPerformance, $endOfMonth])
            ->whereNotIn('payment_status', ['refunded', 'cancelled'])
            ->sum('discount_amount');
        $monthlyWriteOffs = (float) SalesOrder::whereBetween('order_date', [$startOfPerformance, $endOfMonth])
            ->whereNotIn('payment_status', ['refunded', 'cancelled'])
            ->sum('write_off_amount');
        $monthlyItems = SalesOrderItem::whereHas('salesOrder', function ($q) use ($startOfPerformance, $endOfMonth) {
            $q->whereBetween('order_date', [$startOfPerformance, $endOfMonth])
                ->whereNotIn('payment_status', ['refunded', 'cancelled']);
        })->get(['unit_price', 'unit_cost', 'quantity', 'bonus_amount']);
        // Preserve below-cost sales as losses. Historical rows may have been
        // stored with profit=0, so recalculate from immutable sale facts.
        $itemProfits = $monthlyItems->sum(fn (SalesOrderItem $item): float => $this->realizedItemProfit($item));
        $monthlyGrossProfit = $itemProfits - $monthlyDiscounts - $monthlyWriteOffs;

        $monthlyManualExpenses = (float) Expense::whereBetween('date', [$startOfPerformance, $endOfMonth])
            ->where('is_owner_draw', false)
            ->where('category', '!=', 'vendor_payout')
            ->sum('amount');

        $monthlyTransactionFees = (float) FinancialTransaction::whereBetween('date', [$startOfPerformance, $endOfMonth])
            ->sum('fee');

        $monthlyExpenses = $monthlyManualExpenses + $monthlyTransactionFees;

        // Owner withdrawals are cash/equity movements, not operating
        // expenses. The financial transaction ledger is authoritative here
        // and also covers owner draws recorded outside the expense form.
        $monthlyOwnerDraws = (float) FinancialTransaction::whereBetween('date', [$startOfPerformance, $endOfMonth])
            ->where('type', 'owner_draw')
            ->sum('amount');

        $monthlyNetProfit = $monthlyGrossProfit - $monthlyExpenses;

        // Prior period revenue for trend calculation
        $priorRevenue = (float) SalesOrder::whereBetween('order_date', [$priorStart, $priorEnd])
            ->whereNotIn('payment_status', ['refunded', 'cancelled'])
            ->sum('total_amount');

        $trendPercentage = 0.0;
        $trendIsUp = true;
        if ($priorRevenue > 0) {
            $diff = $monthlyRevenue - $priorRevenue;
            $trendPercentage = round(($diff / $priorRevenue) * 100, 1);
            $trendIsUp = $trendPercentage >= 0;
        } elseif ($monthlyRevenue > 0) {
            $trendPercentage = 100.0;
            $trendIsUp = true;
        } else {
            $trendPercentage = 0.0;
            $trendIsUp = true;
        }

        $salesTrend = [
            'percentage' => abs($trendPercentage),
            'raw_percentage' => $trendPercentage,
            'is_up' => $trendIsUp,
            'prior_revenue' => round($priorRevenue, 2),
            'current_revenue' => round($monthlyRevenue, 2),
            'comparison_label' => $comparisonLabel,
            'range' => $range,
        ];

        // Top sold model across all categories within the active period
        $topSoldItems = SalesOrderItem::whereHas('salesOrder', function ($q) use ($startOfPerformance, $endOfMonth) {
            $q->whereBetween('order_date', [$startOfPerformance, $endOfMonth])
                ->whereNotIn('payment_status', ['refunded', 'cancelled']);
        })
            ->with(['variant.product', 'inventoryUnit.variant.product'])
            ->get();

        $productCounts = [];
        foreach ($topSoldItems as $item) {
            $name = $item->variant?->product?->name
                ?? $item->inventoryUnit?->variant?->product?->name
                ?? ($item->accessory_name ?: null);
            if (! $name) {
                continue;
            }
            $qty = (int) $item->quantity;
            if (! isset($productCounts[$name])) {
                $productCounts[$name] = [
                    'name' => $name,
                    'units_sold' => 0,
                    'total_revenue' => 0.0,
                ];
            }
            $productCounts[$name]['units_sold'] += $qty;
            $productCounts[$name]['total_revenue'] += (float) $item->unit_price * $qty;
        }

        uasort($productCounts, fn ($a, $b) => $b['units_sold'] <=> $a['units_sold'] ?: $b['total_revenue'] <=> $a['total_revenue']);
        $topProduct = ! empty($productCounts) ? array_values($productCounts)[0] : null;

        // 6. Recent Sales Orders (filtered by selected month)
        $recentSales = SalesOrder::with(['customer', 'salesperson', 'items.variant.product'])
            ->whereBetween('order_date', [$startOfMonth, $endOfMonth])
            ->latest('order_date')
            ->take(5)
            ->get();

        // 7. Top Receivables (Parties who owe the shop money net)
        $topReceivables = Debt::with(['contact', 'payments.financialAccount'])
            ->where('type', 'receivable')
            ->where('created_at', '<=', $endOfMonth)
            ->whereIn('contact_id', $netReceivableContactIds)
            ->where(function ($q) {
                $q->whereIn('status', ['open', 'partially_paid'])
                    ->orWhere(function ($sq) {
                        $sq->where('status', 'settled')
                            ->where('updated_at', '>=', now()->subHours(12));
                    });
            })
            ->orderByRaw("CASE WHEN status IN ('open', 'partially_paid') THEN 0 ELSE 1 END")
            ->orderBy('created_at')
            ->take(60)
            ->get();

        // 8. Top Payables (Trade payables + Staff commission bonus payables)
        $topTradePayables = Debt::with(['contact', 'payments.financialAccount'])
            ->where('type', 'payable')
            ->where('reference_type', '!=', 'salesperson_bonus')
            ->where('created_at', '<=', $endOfMonth)
            ->whereIn('contact_id', $netPayableContactIds)
            ->where(function ($q) {
                $q->whereIn('status', ['open', 'partially_paid'])
                    ->orWhere(function ($sq) {
                        $sq->where('status', 'settled')
                            ->where('updated_at', '>=', now()->subHours(12));
                    });
            })
            ->orderByRaw("CASE WHEN status IN ('open', 'partially_paid') THEN 0 ELSE 1 END")
            ->orderBy('created_at')
            ->take(60)
            ->get();

        $topBonusPayables = Debt::with(['contact', 'payments.financialAccount'])
            ->where('type', 'payable')
            ->where('reference_type', 'salesperson_bonus')
            ->where('created_at', '<=', $endOfMonth)
            ->where(function ($q) {
                $q->whereIn('status', ['open', 'partially_paid'])
                    ->orWhere(function ($sq) {
                        $sq->where('status', 'settled')
                            ->where('updated_at', '>=', now()->subHours(12));
                    });
            })
            ->orderByRaw("CASE WHEN status IN ('open', 'partially_paid') THEN 0 ELSE 1 END")
            ->orderBy('created_at')
            ->take(30)
            ->get();

        $topPayables = $topTradePayables->concat($topBonusPayables);

        // 9. Sales chart points for the selected range
        $periodOrders = SalesOrder::with('items')
            ->whereBetween('order_date', [$startOfPerformance, $endOfMonth])
            ->whereNotIn('payment_status', ['refunded', 'cancelled'])
            ->orderBy('order_date')
            ->get();

        if ($range === '3m' || $range === '6m' || $range === '1y') {
            $buckets = [];
            $curr = $startOfPerformance->copy()->startOfMonth();
            while ($curr <= $endOfMonth) {
                $mKey = $curr->format('Y-m');
                $buckets[$mKey] = [
                    'date' => $mKey,
                    'day' => $range === '1y' ? $curr->format('M Y') : $curr->format('M'),
                    'revenue' => 0.0,
                    'profit' => 0.0,
                    'write_offs' => 0.0,
                    'orders' => 0,
                ];
                $curr->addMonth();
            }

            foreach ($periodOrders as $o) {
                $mKey = Carbon::parse($o->order_date)->format('Y-m');
                if (isset($buckets[$mKey])) {
                    $buckets[$mKey]['revenue'] += (float) $o->total_amount;
                    $itemProfit = (float) $o->items->sum(fn (SalesOrderItem $item): float => $this->realizedItemProfit($item));
                    $disc = (float) $o->discount_amount;
                    $writeOff = (float) $o->write_off_amount;
                    $buckets[$mKey]['profit'] += ($itemProfit - $disc - $writeOff);
                    $buckets[$mKey]['write_offs'] += $writeOff;
                    $buckets[$mKey]['orders'] += 1;
                }
            }

            $salesChart = array_values(array_map(fn ($b) => [
                'date' => $b['date'],
                'day' => $b['day'],
                'revenue' => round($b['revenue'], 2),
                'profit' => round($b['profit'], 2),
                'write_offs' => round($b['write_offs'], 2),
                'orders' => $b['orders'],
            ], $buckets));
        } else {
            $groupedOrders = $periodOrders->groupBy(fn ($o) => Carbon::parse($o->order_date)->format('Y-m-d'));
            $formatDay = fn ($key) => Carbon::parse($key)->format('M d');

            $salesChart = [];
            foreach ($groupedOrders as $date => $dayOrders) {
                $dayRev = (float) $dayOrders->sum('total_amount');
                $dayDisc = (float) $dayOrders->sum('discount_amount');
                $dayItemProfit = (float) $dayOrders->flatMap->items->sum(fn (SalesOrderItem $item): float => $this->realizedItemProfit($item));
                $dayWriteOff = (float) $dayOrders->sum('write_off_amount');
                $dayProfit = $dayItemProfit - $dayDisc - $dayWriteOff;

                $salesChart[] = [
                    'date' => $date,
                    'day' => $formatDay($date),
                    'revenue' => round($dayRev, 2),
                    'profit' => round($dayProfit, 2),
                    'write_offs' => round($dayWriteOff, 2),
                    'orders' => count($dayOrders),
                ];
            }
        }

        // 10. Partner & Peer Vendor Net Balances (Bilateral Netting)
        $partnerContacts = Contact::where('is_active', true)
            ->where(function ($q) {
                $q->whereJsonContains('roles', 'peer_vendor')
                    ->orWhereJsonContains('roles', 'supplier')
                    ->orWhereJsonContains('roles', 'partner')
                    ->orWhereHas('debts', fn ($dq) => $dq->where('reference_type', '!=', 'salesperson_bonus'))
                    ->orWhereHas('suppliedUnits');
            })
            ->with(['debts' => fn ($q) => $q->where('created_at', '<=', $endOfMonth)
                ->where('reference_type', '!=', 'salesperson_bonus')
                ->whereIn('status', ['open', 'partially_paid'])])
            ->get();

        $partnerSettlements = [];
        $totalOwedToUsNet = 0.0;
        $totalWeOweNet = 0.0;
        $partnersOwingUsCount = 0;
        $partnersWeOweCount = 0;

        foreach ($partnerContacts as $p) {
            $rec = (float) $p->debts
                ->where('type', 'receivable')
                ->sum('remaining_amount');

            $pay = (float) $p->debts
                ->where('type', 'payable')
                ->sum('remaining_amount');

            // Also check un-debted in-stock units
            $debts = $p->debts;
            $existingStockIntakeUnitIds = $debts->where('reference_type', 'stock_intake')->pluck('reference_id')->filter()->all();
            $consignmentOrderIds = $debts->where('reference_type', 'consignment_sale')->pluck('reference_id')->filter()->all();
            $soldUnitIdsWithDebt = SalesOrderItem::whereIn('sales_order_id', $consignmentOrderIds)
                ->whereNotNull('inventory_unit_id')
                ->pluck('inventory_unit_id')
                ->all();
            $allDebtedUnitIds = array_unique(array_merge($existingStockIntakeUnitIds, $soldUnitIdsWithDebt));

            $unDebtStockPayable = (float) InventoryUnit::where('supplier_contact_id', $p->id)
                ->where('created_at', '<=', $endOfMonth)
                ->where('status', 'in_stock')
                ->whereNotIn('source_type', ['exchange', 'vendor_direct'])
                ->whereNull('exchange_sales_order_id')
                ->whereNotIn('id', $allDebtedUnitIds)
                ->sum('cost_basis');

            $pay += $unDebtStockPayable;
            $net = $rec - $pay;

            if (abs($net) >= 0.01 || $rec > 0 || $pay > 0) {
                if ($net > 0) {
                    $totalOwedToUsNet += $net;
                    $partnersOwingUsCount++;
                } elseif ($net < 0) {
                    $totalWeOweNet += abs($net);
                    $partnersWeOweCount++;
                }

                $activeHandoversCount = $p->debts
                    ->where('type', 'receivable')
                    ->where('reference_type', 'handover_holding')
                    ->count();

                $suppliedInStockCount = InventoryUnit::where('supplier_contact_id', $p->id)
                    ->where('created_at', '<=', $endOfMonth)
                    ->where('status', 'in_stock')
                    ->where('source_type', '!=', 'exchange')
                    ->whereNull('exchange_sales_order_id')
                    ->count();

                $partnerSettlements[] = [
                    'id' => $p->id,
                    'name' => $p->name,
                    'phone' => $p->phone,
                    'statement_token' => $p->statement_token,
                    'open_receivable' => round($rec, 2),
                    'open_payable' => round($pay, 2),
                    'net_balance' => round($net, 2),
                    'verdict' => $net > 0 ? 'owes_us' : ($net < 0 ? 'we_owe' : 'settled'),
                    'active_handovers_count' => $activeHandoversCount,
                    'supplied_in_stock_count' => $suppliedInStockCount,
                ];
            }
        }

        usort($partnerSettlements, fn ($a, $b) => abs($b['net_balance']) <=> abs($a['net_balance']));

        return response()->json([
            'success' => true,
            'data' => [
                'capital_overview' => [
                    'net_capital' => $netCapital,
                    'stock_value' => $totalStockValue,
                    'vendor_stock_value' => $vendorConsignmentStockValue,
                    'total_shelf_stock_value' => $totalShelfStockValue,
                    'receivables' => $totalReceivablesNetted,
                    'cash_and_banks' => $cashAndBankBalance,
                    'custom_assets' => $customAssetsBalance,
                    'liquid_finance' => $cashAndBankBalance,
                    'forex_assets' => $forexBalance,
                    'gold_assets' => $goldBalance,
                    'other_assets' => $otherAssetsBalance,
                    'payables' => $totalPayablesNetted,
                    'net_receivables' => $totalReceivablesNetted,
                    'net_payables' => $totalPayablesNetted,
                    'gross_receivables' => $grossReceivables,
                    'gross_payables' => $grossPayables,
                ],
                'monthly_performance' => [
                    'selected_month' => $startOfMonth->format('Y-m'),
                    'revenue' => $monthlyRevenue,
                    'net_revenue' => $monthlyRevenue - $monthlyDiscounts - $monthlyWriteOffs,
                    'discounts' => $monthlyDiscounts,
                    'write_offs' => $monthlyWriteOffs,
                    'gross_profit' => $monthlyGrossProfit,
                    'operating_expenses' => $monthlyExpenses,
                    'manual_expenses' => $monthlyManualExpenses,
                    'transaction_fees' => $monthlyTransactionFees,
                    'owner_draws' => $monthlyOwnerDraws,
                    'net_profit' => $monthlyNetProfit,
                    'sales_trend' => $salesTrend,
                    'top_product' => $topProduct,
                ],
                'counts' => [
                    'in_stock_phones' => InventoryUnit::where('created_at', '<=', $endOfMonth)
                        ->where('status', 'in_stock')
                        ->whereIn('source_type', ['purchase', 'exchange'])
                        ->count(),
                    'vendor_consignment_phones' => InventoryUnit::where('created_at', '<=', $endOfMonth)
                        ->where('status', 'in_stock')
                        ->where('source_type', 'consignment')
                        ->count(),
                    'total_shelf_phones' => InventoryUnit::where('created_at', '<=', $endOfMonth)
                        ->where('status', 'in_stock')
                        ->whereNotIn('source_type', ['vendor_direct'])
                        ->count(),
                    'open_receivables' => $netReceivableParties,
                    'open_receivable_parties' => $netReceivableParties,
                    'open_payables' => $netPayableParties + $pendingBonusStaffCount,
                    'open_payable_parties' => $netPayableParties + $pendingBonusStaffCount,
                    'gross_open_receivables' => Debt::where('created_at', '<=', $endOfMonth)->where('type', 'receivable')->whereIn('status', ['open', 'partially_paid'])->count(),
                    'gross_open_payables' => Debt::where('created_at', '<=', $endOfMonth)->where('type', 'payable')->whereIn('status', ['open', 'partially_paid'])->count(),
                    'net_receivable_parties' => $netReceivableParties,
                    'net_payable_parties' => $netPayableParties + $pendingBonusStaffCount,
                    'uncollected_staff_bonuses' => $uncollectedStaffBonuses,
                    'pending_bonus_staff_count' => $pendingBonusStaffCount,
                ],
                'partner_settlements' => [
                    'partners_owing_us_count' => $partnersOwingUsCount,
                    'total_owed_to_us_net' => round($totalOwedToUsNet, 2),
                    'partners_we_owe_count' => $partnersWeOweCount,
                    'total_we_owe_net' => round($totalWeOweNet, 2),
                    'partners' => $partnerSettlements,
                ],
                'recent_sales' => $recentSales,
                'top_receivables' => $topReceivables,
                'top_payables' => $topPayables,
                'sales_chart' => $salesChart,
                'sales_trend' => $salesTrend,
                'top_product' => $topProduct,
                'range' => $range,
            ],
        ]);
    }

    private function realizedItemProfit(SalesOrderItem $item): float
    {
        return ((float) $item->unit_price - (float) $item->unit_cost) * (int) $item->quantity
            - (float) $item->bonus_amount;
    }
}
