<?php

namespace App\Actions\Undo;

use App\Models\AuditLog;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\InventoryUnit;
use App\Models\MaintenanceRecord;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ProformaInvoice;
use App\Models\SalesOrder;
use Carbon\Carbon;

class UndoBlockedChecker
{
    /**
     * Check if undoing a sale is blocked by downstream activities.
     *
     * @return array<int, string> List of blocking reasons (empty if not blocked)
     */
    public function checkSale(SalesOrder $order, AuditLog $log): array
    {
        $reasons = [];

        // 1. Check if subsequent customer payments have been collected against this sale
        $receivableDebts = Debt::where('tenant_id', $order->tenant_id)
            ->where('reference_type', 'sales_order')
            ->where('reference_id', $order->id)
            ->get();

        foreach ($receivableDebts as $debt) {
            $threshold = Carbon::parse($log->created_at)->addSeconds(5);
            $subsequentPayments = DebtPayment::where('debt_id', $debt->id)
                ->where('created_at', '>', $threshold)
                ->get();

            if ($subsequentPayments->isNotEmpty()) {
                $totalPaid = $subsequentPayments->sum('amount');
                $reasons[] = "A customer debt payment of {$totalPaid} ETB was collected against this sale after it was created. Undo that payment collection first.";
            }
        }

        // 2. Check if salesperson bonus was already settled/paid out to staff
        $bonusDebts = Debt::where('tenant_id', $order->tenant_id)
            ->where('reference_type', 'salesperson_bonus')
            ->where('reference_id', $order->id)
            ->get();

        foreach ($bonusDebts as $bDebt) {
            if ((float) $bDebt->paid_amount > 0) {
                $reasons[] = "The salesperson commission bonus of {$bDebt->paid_amount} ETB was already paid out to staff. Reverse that staff payment first.";
            }
        }

        // 3. Check if trade-in exchange device has moved from in_stock
        if (! empty($order->exchange_unit_id)) {
            $exchangeUnit = InventoryUnit::find($order->exchange_unit_id);
            if (! $exchangeUnit) {
                $reasons[] = 'The trade-in device record could not be found.';
            } elseif ($exchangeUnit->status !== 'in_stock') {
                $reasons[] = "The trade-in device ({$exchangeUnit->imei_or_serial}) is no longer In Stock (current status: {$exchangeUnit->status}). It may have been sold or transferred.";
            }
        }

        // 4. Check if any sold inventory units have since been returned, swapped, or resold
        foreach ($order->items as $item) {
            if (! empty($item->inventory_unit_id)) {
                $unit = InventoryUnit::find($item->inventory_unit_id);
                if ($unit) {
                    if ($unit->status !== 'sold') {
                        $reasons[] = "Device ({$unit->imei_or_serial}) status has changed to '{$unit->status}' after this sale (e.g., customer return or warranty swap).";
                    }
                    if ($unit->sold_at && $log->created_at && Carbon::parse($unit->sold_at)->gt(Carbon::parse($log->created_at)->addMinutes(5))) {
                        $reasons[] = "Device ({$unit->imei_or_serial}) was recorded as sold in a different transaction.";
                    }
                }
            }
        }

        return $reasons;
    }

    /**
     * Check if undoing a payment collection is blocked.
     *
     * @return array<int, string>
     */
    public function checkPaymentCollection(SalesOrder $order, AuditLog $log): array
    {
        $reasons = [];

        // Check if debts have been completely modified or settled by a subsequent bilateral debt offset
        $debts = Debt::where('tenant_id', $order->tenant_id)
            ->where('reference_type', 'sales_order')
            ->where('reference_id', $order->id)
            ->get();

        foreach ($debts as $debt) {
            $threshold = Carbon::parse($log->created_at)->addSeconds(5);
            $newerPayments = DebtPayment::where('debt_id', $debt->id)
                ->where('created_at', '>', $threshold)
                ->count();

            if ($newerPayments > 0) {
                $reasons[] = "Another payment was recorded against this order's debt after this collection. Undo subsequent collections first.";
            }
        }

        return $reasons;
    }

    /**
     * Check if undoing a stock intake is blocked.
     *
     * @param  array<int, string>  $unitIds
     * @return array<int, string>
     */
    public function checkStockIntake(array $unitIds): array
    {
        $reasons = [];

        $units = InventoryUnit::with('variant.product')->whereIn('id', $unitIds)->get();

        foreach ($units as $unit) {
            if ($unit->status !== 'in_stock') {
                /** @var ProductVariant|null $variant */
                $variant = $unit->variant;
                /** @var Product|null $prod */
                $prod = $variant?->product;
                $prodName = $prod ? $prod->name : 'Device';
                $ident = $unit->imei_or_serial ?: $unit->id;
                $reasons[] = "The {$prodName} ({$ident}) from this intake is no longer In Stock (current status: {$unit->status}). Reverse that sale or handover first.";
            }
        }

        // Check if supplier debt from this intake has been paid
        $debts = Debt::where('reference_type', 'stock_intake')
            ->whereIn('reference_id', $unitIds)
            ->get();

        foreach ($debts as $debt) {
            if ((float) $debt->paid_amount > 0) {
                $reasons[] = "A supplier payment of {$debt->paid_amount} ETB was made towards this stock intake. Undo that payment first.";
            }
        }

        return $reasons;
    }

    /**
     * Check if undoing a unit handover is blocked.
     *
     * @return array<int, string>
     */
    public function checkHandover(InventoryUnit $unit): array
    {
        $reasons = [];

        if ($unit->status !== 'out') {
            $reasons[] = "This device ({$unit->imei_or_serial}) is no longer handed out (current status: '{$unit->status}'). It was likely confirmed sold or returned.";
        }

        return $reasons;
    }

    /**
     * Check if undoing a handover sale / instant offset is blocked.
     *
     * @return array<int, string>
     */
    public function checkHandoverSold(InventoryUnit $unit, AuditLog $log): array
    {
        $reasons = [];

        // Check if the sales order created for this handover sale has downstream debt payments
        $createdOrder = SalesOrder::where('tenant_id', $unit->tenant_id)
            ->where('notes', 'like', "%[unit_id:{$unit->id}]%")
            ->first();

        if ($createdOrder) {
            $reasons = array_merge($reasons, $this->checkSale($createdOrder, $log));
        }

        return $reasons;
    }

    /**
     * Check if undoing an expense is blocked.
     *
     * @return array<int, string>
     */
    public function checkExpense(string $expenseId): array
    {
        $reasons = [];

        // Check if tied to a maintenance record
        $maintenance = MaintenanceRecord::where('id', $expenseId)->first();
        if ($maintenance && $maintenance->inventory_unit_id) {
            $unit = InventoryUnit::find($maintenance->inventory_unit_id);
            if ($unit && $unit->status === 'sold') {
                $reasons[] = "This repair expense is attached to a device ({$unit->imei_or_serial}) that has already been delivered to the customer.";
            }
        }

        return $reasons;
    }

    /**
     * Check if undoing a proforma invoice is blocked.
     *
     * @return array<int, string>
     */
    public function checkProformaInvoice(ProformaInvoice $proforma): array
    {
        $reasons = [];

        if ($proforma->status === 'converted' || ! empty($proforma->converted_sales_order_id)) {
            $reasons[] = "This proforma invoice ({$proforma->proforma_number}) has already been converted into a confirmed sale. Undo that sale first.";
        }

        return $reasons;
    }
}
