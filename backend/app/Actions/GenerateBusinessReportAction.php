<?php

namespace App\Actions;

use App\Models\Contact;
use App\Models\Debt;
use App\Models\Expense;
use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use App\Models\InventoryUnit;
use App\Models\MaintenanceRecord;
use App\Models\SalesOrder;
use App\Models\SalesOrderItem;
use App\Services\AccountBalanceService;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class GenerateBusinessReportAction
{
    /**
     * @return array<string, mixed>
     */
    public function execute(Carbon $from, Carbon $to): array
    {
        $start = $from->copy()->startOfDay();
        $end = $to->copy()->endOfDay();

        $orders = SalesOrder::query()
            ->with(['items', 'salesperson'])
            ->whereBetween('order_date', [$start, $end])
            ->whereNotIn('payment_status', ['refunded', 'cancelled'])
            ->orderBy('order_date')
            ->get();

        $items = SalesOrderItem::query()
            ->with(['salesOrder', 'vendorContact', 'variant.product', 'inventoryUnit'])
            ->whereHas('salesOrder', fn ($query) => $query->whereBetween('order_date', [$start, $end])->whereNotIn('payment_status', ['refunded', 'cancelled']))
            ->get();

        $revenue = (float) $orders->sum('total_amount');
        $discounts = (float) $orders->sum('discount_amount');
        $writeOffs = (float) $orders->sum('write_off_amount');
        $customerReceipts = (float) $orders->sum('paid_amount');
        $netRevenue = $revenue - $discounts - $writeOffs;
        // Gross profit may be negative when stock is sold below cost.
        $grossProfit = $items->sum(fn (SalesOrderItem $item): float => $this->realizedItemProfit($item)) - $discounts - $writeOffs;
        // Discounts and intentional write-offs are order-level reductions. Allocate
        // them across line items so the loss detail agrees with the headline profit.
        $lossMakingItems = $items->filter(fn (SalesOrderItem $item): bool => $this->reportItemProfit($item) < 0);
        $lossAmount = abs((float) $lossMakingItems->sum(fn (SalesOrderItem $item): float => $this->reportItemProfit($item)));
        $operatingExpenses = (float) Expense::query()
            ->whereBetween('date', [$start, $end])
            ->where('is_owner_draw', false)
            ->where('category', '!=', 'vendor_payout')
            ->sum('amount');
        $transactionFees = (float) FinancialTransaction::query()
            ->whereBetween('date', [$start, $end])
            ->sum('fee');
        $ownerDraws = (float) FinancialTransaction::query()
            ->whereBetween('date', [$start, $end])
            ->where('type', 'owner_draw')
            ->sum('amount');
        $netProfit = $grossProfit - $operatingExpenses - $transactionFees;

        $dailyPerformance = $this->dailyPerformance($orders);
        $salesDays = $dailyPerformance->filter(fn (array $day) => $day['revenue'] > 0);
        $peakDay = $salesDays->sortByDesc('revenue')->first();
        $lowDay = $salesDays->sortBy('revenue')->first();
        $repairRecords = MaintenanceRecord::query()->whereBetween('date', [$start, $end]);

        return [
            'period' => [
                'from' => $start->toDateString(),
                'to' => $end->toDateString(),
                'label' => $this->periodLabel($start, $end),
            ],
            'summary' => [
                'revenue' => round($revenue, 2),
                'net_revenue' => round($netRevenue, 2),
                'customer_receipts' => round($customerReceipts, 2),
                'discounts' => round($discounts, 2),
                'write_offs' => round($writeOffs, 2),
                'gross_profit' => round($grossProfit, 2),
                'loss_making_items' => $lossMakingItems->count(),
                'loss_amount' => round($lossAmount, 2),
                'loss_items' => $lossMakingItems->map(function (SalesOrderItem $item): array {
                    $loss = $this->reportItemProfit($item);

                    return [
                        'id' => $item->id,
                        'product' => $item->variant?->display_name ?? 'Unidentified product',
                        'imei_or_serial' => $item->inventoryUnit?->imei_or_serial,
                        'order_number' => $item->salesOrder?->order_number,
                        'order_date' => $item->salesOrder?->order_date?->toDateString(),
                        'quantity' => (int) $item->quantity,
                        'unit_price' => round((float) $item->unit_price, 2),
                        'unit_cost' => round((float) $item->unit_cost, 2),
                        'loss' => round(abs($loss), 2),
                        'loss_reason' => $this->realizedItemProfit($item) < 0 ? 'Below-cost sale' : 'Discount or price concession',
                    ];
                })->values()->all(),
                'operating_expenses' => round($operatingExpenses, 2),
                'transaction_fees' => round($transactionFees, 2),
                'owner_draws' => round($ownerDraws, 2),
                'net_profit' => round($netProfit, 2),
                'result' => $netProfit > 0 ? 'profit' : ($netProfit < 0 ? 'loss' : 'break_even'),
                'orders' => $orders->count(),
                'units_sold' => (int) $items->sum('quantity'),
                'average_order_value' => $orders->isNotEmpty() ? round($revenue / $orders->count(), 2) : 0.0,
            ],
            'sales_trend' => $dailyPerformance->values()->all(),
            'sales_extremes' => [
                'peak_day' => $peakDay,
                'low_day' => $lowDay,
            ],
            'staff_performance' => $this->staffPerformance($orders, $items),
            'vendor_activity' => $this->vendorActivity($start, $end, $items),
            'repairs' => [
                'reported_count' => InventoryUnit::query()
                    ->whereBetween('updated_at', [$start, $end])
                    ->whereNotNull('return_reason')
                    ->whereIn('status', ['returned', 'damaged', 'fixed', 'returned_to_vendor'])
                    ->count(),
                'repaired_count' => (clone $repairRecords)->count(),
                'repair_expense' => round((float) $repairRecords->sum('cost'), 2),
            ],
            'stock_position' => $this->stockPosition($end),
            'cash_position' => $this->cashPosition($end),
            'reconciliation' => $this->balanceReconciliation($start, $end),
            'financial_position' => $this->financialPosition($end),
        ];
    }

    /**
     * @return Collection<int, array{date: string, label: string, revenue: float, profit: float, orders: int, units: int}>
     */
    private function dailyPerformance(Collection $orders): Collection
    {
        return $orders
            ->groupBy(fn (SalesOrder $order) => $order->order_date->toDateString())
            ->map(function (Collection $dayOrders, string $date): array {
                $profit = $dayOrders->flatMap->items->sum(fn (SalesOrderItem $item): float => $this->realizedItemProfit($item))
                    - (float) $dayOrders->sum('discount_amount')
                    - (float) $dayOrders->sum('write_off_amount');

                return [
                    'date' => $date,
                    'label' => Carbon::parse($date)->format('M j'),
                    'revenue' => round((float) $dayOrders->sum('total_amount'), 2),
                    'profit' => round($profit, 2),
                    'orders' => $dayOrders->count(),
                    'units' => (int) $dayOrders->flatMap->items->sum('quantity'),
                ];
            })
            ->sortKeys();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function staffPerformance(Collection $orders, Collection $items): array
    {
        // The owner can be recorded as the salesperson for audit purposes, but
        // this section is specifically the staff-sales leaderboard.
        return $orders
            ->filter(fn (SalesOrder $order): bool => $order->salesperson?->role === 'salesperson')
            ->groupBy('salesperson_id')
            ->map(function (Collection $staffOrders, mixed $salespersonId) use ($items): array {
                $staffItems = $items->where('salesOrder.salesperson_id', $salespersonId);
                $salesperson = $staffOrders->first()?->salesperson;

                return [
                    'user_id' => $salespersonId,
                    'name' => $salesperson?->name ?? 'Unassigned sale',
                    'role' => $salesperson?->role ?? null,
                    'orders' => $staffOrders->count(),
                    'units' => (int) $staffItems->sum('quantity'),
                    'revenue' => round((float) $staffOrders->sum('total_amount'), 2),
                    'profit' => round((float) $staffItems->sum(fn (SalesOrderItem $item): float => $this->realizedItemProfit($item)) - (float) $staffOrders->sum('discount_amount') - (float) $staffOrders->sum('write_off_amount'), 2),
                ];
            })
            ->sortByDesc('revenue')
            ->values()
            ->all();
    }

    /**
     * @return array{most_active: array<string, mixed>|null, least_active: array<string, mixed>|null, vendors: array<int, array<string, mixed>>}
     */
    private function vendorActivity(Carbon $start, Carbon $end, Collection $items): array
    {
        $vendorContacts = Contact::query()
            ->where(function ($query): void {
                $query->whereJsonContains('roles', 'peer_vendor')
                    ->orWhereJsonContains('roles', 'supplier')
                    ->orWhereHas('suppliedUnits');
            })
            ->get();

        $vendorIds = $vendorContacts->pluck('id');
        $receivedByVendor = InventoryUnit::query()
            ->whereIn('supplier_contact_id', $vendorIds)
            ->whereBetween('created_at', [$start, $end])
            ->get(['supplier_contact_id'])
            ->countBy('supplier_contact_id');
        $returnsByVendor = InventoryUnit::query()
            ->whereIn('supplier_contact_id', $vendorIds)
            ->whereBetween('returned_at', [$start, $end])
            ->where('status', 'returned_to_vendor')
            ->get(['supplier_contact_id'])
            ->countBy('supplier_contact_id');

        $vendors = $vendorContacts
            ->map(function (Contact $vendor) use ($items, $receivedByVendor, $returnsByVendor): array {
                $soldItems = $items->where('vendor_contact_id', $vendor->id);
                $received = (int) ($receivedByVendor[$vendor->id] ?? 0);
                $returns = (int) ($returnsByVendor[$vendor->id] ?? 0);

                return [
                    'id' => $vendor->id,
                    'name' => $vendor->name,
                    'units_sold' => (int) $soldItems->sum('quantity'),
                    'revenue' => round((float) $soldItems->sum(fn ($item) => $item->unit_price * $item->quantity), 2),
                    'received_units' => $received,
                    'returned_units' => $returns,
                    'activity_count' => $received + $returns + (int) $soldItems->sum('quantity'),
                ];
            })
            ->sortByDesc('activity_count')
            ->values();

        return [
            'most_active' => $vendors->first(),
            'least_active' => $vendors->sortBy('activity_count')->first(),
            'vendors' => $vendors->all(),
        ];
    }

    /**
     * @return array<string, float|int>
     */
    private function stockPosition(Carbon $end): array
    {
        $ownedStock = InventoryUnit::query()
            ->where('created_at', '<=', $end)
            ->where('status', 'in_stock')
            ->whereNotIn('source_type', ['consignment', 'exchange', 'vendor_direct']);
        $vendorStock = InventoryUnit::query()
            ->where('created_at', '<=', $end)
            ->where('status', 'in_stock')
            ->where('source_type', 'consignment');

        return [
            'owned_units' => $ownedStock->count(),
            'owned_value' => round((float) $ownedStock->sum('cost_basis'), 2),
            'vendor_units' => $vendorStock->count(),
            'vendor_value' => round((float) $vendorStock->sum('cost_basis'), 2),
        ];
    }

    /**
     * @return array{cash_and_bank: float, custom_assets: float, total_liquidity_and_assets: float, accounts: array<int, array<string, mixed>>}
     */
    private function cashPosition(Carbon $end): array
    {
        $allAccounts = FinancialAccount::query()->where('created_at', '<=', $end)->orderBy('name')->get();
        (new AccountBalanceService)->calculateBalancesAsOf($allAccounts, $end);

        $liquidAccounts = $allAccounts->where('is_custom_asset', false);
        $customAccounts = $allAccounts->where('is_custom_asset', true);

        return [
            'cash_and_bank' => round((float) $liquidAccounts->sum('current_balance'), 2),
            'custom_assets' => round((float) $customAccounts->sum('current_balance'), 2),
            'total_liquidity_and_assets' => round((float) $allAccounts->sum('current_balance'), 2),
            'accounts' => $allAccounts->map(fn (FinancialAccount $account): array => [
                'id' => $account->id,
                'name' => $account->name,
                'type' => $account->type,
                'is_custom_asset' => (bool) $account->is_custom_asset,
                'balance' => round((float) $account->current_balance, 2),
            ])->values()->all(),
        ];
    }

    /**
     * Financial position is separate from cash reconciliation. Consignment stock
     * remains custody inventory and is intentionally excluded from owned assets.
     *
     * @return array<string, mixed>
     */
    private function financialPosition(Carbon $end): array
    {
        $openPayables = Debt::query()
            ->with('contact')
            ->where('type', 'payable')
            ->whereIn('status', ['open', 'partially_paid'])
            ->get();
        $openReceivables = Debt::query()
            ->with('contact')
            ->where('type', 'receivable')
            ->whereIn('status', ['open', 'partially_paid'])
            ->get();

        $cash = $this->cashPosition($end);
        $ownedStock = (float) $this->stockPosition($end)['owned_value'];
        $customAssets = (float) ($cash['custom_assets'] ?? 0);
        $receivables = (float) $openReceivables->sum('remaining_amount');
        $payables = (float) $openPayables->sum('remaining_amount');
        $assets = $cash['cash_and_bank'] + $ownedStock + $customAssets + $receivables;

        return [
            'assets' => [
                'cash_and_bank' => round((float) $cash['cash_and_bank'], 2),
                'owned_stock' => round($ownedStock, 2),
                'customer_receivables' => round($receivables, 2),
                'custom_assets' => round($customAssets, 2),
                'total' => round($assets, 2),
            ],
            'liabilities' => [
                'open_payables' => round($payables, 2),
                'open_payable_count' => $openPayables->count(),
                'payables' => $openPayables->map(fn (Debt $debt): array => [
                    'id' => $debt->id,
                    'contact' => $debt->contact?->name ?? 'Unassigned',
                    'reference_type' => $debt->reference_type,
                    'remaining_amount' => round((float) $debt->remaining_amount, 2),
                    'status' => $debt->status,
                ])->values()->all(),
            ],
            'net_position' => round($assets - $payables, 2),
            'consignment_note' => 'Unsold consignment stock is excluded from owned assets and becomes a payable when sold or otherwise owed to the vendor.',
        ];
    }

    /**
     * Calculate financial balance reconciliation.
     * Formula: Opening Balance + Total Inflows - Total Outflows - Closing Balance = 0.
     *
     * @return array<string, mixed>
     */
    private function balanceReconciliation(Carbon $start, Carbon $end): array
    {
        // A cash reconciliation must contain only liquid accounts. Custom assets
        // are reported in the financial position and must not be called cash.
        $allAccounts = FinancialAccount::withTrashed()
            ->where('is_custom_asset', false)
            ->get();

        $openingBalance = 0.0;
        $initialDeposits = 0.0;

        foreach ($allAccounts as $acc) {
            if ($acc->created_at && $acc->created_at->lt($start)) {
                $inAfter = (float) FinancialTransaction::where('destination_account_id', $acc->id)
                    ->where('date', '>=', $start)
                    ->sum('amount');
                $outAfter = (float) FinancialTransaction::where('source_account_id', $acc->id)
                    ->where('date', '>=', $start)
                    ->sum('amount');
                $feeAfter = (float) FinancialTransaction::where('source_account_id', $acc->id)
                    ->where('date', '>=', $start)
                    ->sum('fee');
                $openingBalance += round((float) $acc->current_balance - $inAfter + $outAfter + $feeAfter, 2);
            } elseif ($acc->created_at && $acc->created_at->between($start, $end)) {
                $inAll = (float) FinancialTransaction::where('destination_account_id', $acc->id)->sum('amount');
                $outAll = (float) FinancialTransaction::where('source_account_id', $acc->id)->sum('amount');
                $feeAll = (float) FinancialTransaction::where('source_account_id', $acc->id)->sum('fee');
                $initialDeposits += round((float) $acc->current_balance - ($inAll - $outAll - $feeAll), 2);
            }
        }

        $closingBalance = 0.0;
        foreach ($allAccounts as $acc) {
            if ($acc->created_at && $acc->created_at->lte($end)) {
                $inAfter = (float) FinancialTransaction::where('destination_account_id', $acc->id)
                    ->where('date', '>', $end)
                    ->sum('amount');
                $outAfter = (float) FinancialTransaction::where('source_account_id', $acc->id)
                    ->where('date', '>', $end)
                    ->sum('amount');
                $feeAfter = (float) FinancialTransaction::where('source_account_id', $acc->id)
                    ->where('date', '>', $end)
                    ->sum('fee');
                $closingBalance += round((float) $acc->current_balance - $inAfter + $outAfter + $feeAfter, 2);
            }
        }

        $txns = FinancialTransaction::whereBetween('date', [$start, $end])->get();

        $customerCollections = (float) $txns->where('type', 'customer_payment')->sum('amount');
        $borrowedFunds = (float) $txns->where('type', 'borrowed_funds')->sum('amount');
        $otherIncome = (float) $txns->where('type', 'income')->sum('amount');
        $supplierPayments = (float) $txns->where('type', 'supplier_payment')->sum('amount');
        $operatingExpenses = (float) $txns->where('type', 'expense')->sum('amount');
        $ownerDraws = (float) $txns->where('type', 'owner_draw')->sum('amount');
        $loanDisbursements = (float) $txns->where('type', 'loan_disbursement')->sum('amount');
        $transactionFees = (float) $txns->sum('fee');

        $totalInflows = round($initialDeposits + $customerCollections + $borrowedFunds + $otherIncome, 2);
        $totalOutflows = round($supplierPayments + $operatingExpenses + $ownerDraws + $loanDisbursements + $transactionFees, 2);

        $expectedClosing = round($openingBalance + $totalInflows - $totalOutflows, 2);
        $variance = round($expectedClosing - $closingBalance, 2);

        return [
            'opening_balance' => round($openingBalance, 2),
            'capital_deposits' => round($initialDeposits, 2),
            'customer_collections' => round($customerCollections, 2),
            'borrowed_funds' => round($borrowedFunds, 2),
            'other_income' => round($otherIncome, 2),
            'total_inflows' => $totalInflows,
            'supplier_payments' => round($supplierPayments, 2),
            'operating_expenses' => round($operatingExpenses, 2),
            'owner_draws' => round($ownerDraws, 2),
            'loan_disbursements' => round($loanDisbursements, 2),
            'transaction_fees' => round($transactionFees, 2),
            'total_outflows' => $totalOutflows,
            'expected_closing' => $expectedClosing,
            'closing_balance' => round($closingBalance, 2),
            'variance' => $variance,
            'is_reconciled' => abs($variance) < 0.01,
        ];
    }

    private function periodLabel(Carbon $from, Carbon $to): string
    {
        if ($from->isSameDay($to)) {
            return $from->format('M j, Y');
        }

        if ($from->isSameMonth($to)) {
            return $from->format('M j').' – '.$to->format('j, Y');
        }

        return $from->format('M j, Y').' – '.$to->format('M j, Y');
    }

    /**
     * Recalculate realized item profit from immutable sale facts. This also
     * protects reports from historical rows created before loss-making profit
     * was allowed to remain negative.
     */
    private function realizedItemProfit(SalesOrderItem $item): float
    {
        if ($item->salesOrder && in_array($item->salesOrder->payment_status, ['refunded', 'cancelled'], true)) {
            return 0.0;
        }

        return ((float) $item->unit_price - (float) $item->unit_cost) * (int) $item->quantity
            - (float) $item->bonus_amount;
    }

    private function reportItemProfit(SalesOrderItem $item): float
    {
        $profit = $this->realizedItemProfit($item);
        $order = $item->salesOrder;
        $orderGross = (float) ($order?->total_amount ?? 0);
        $lineGross = (float) $item->unit_price * (int) $item->quantity;
        $orderAdjustments = (float) ($order?->discount_amount ?? 0) + (float) ($order?->write_off_amount ?? 0);

        if ($orderGross <= 0 || $lineGross <= 0 || $orderAdjustments <= 0) {
            return $profit;
        }

        return $profit - ($orderAdjustments * ($lineGross / $orderGross));
    }
}
