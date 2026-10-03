<?php

namespace App\Actions;

use App\Models\Contact;
use App\Models\Debt;
use App\Models\InventoryUnit;
use App\Models\SalesOrder;
use Carbon\Carbon;

class GeneratePartnerStatementAction
{
    /**
     * Sanitize ledger context to ensure confidentiality and clear, minimal language:
     * - Replaces "Wire payout" with "Transferred"
     * - Strips internal sales order IDs (e.g. #ORD-KZSX2PEF, Order #...)
     * - Replaces internal staff/bonus phrases with clean sold item summaries
     */
    protected function sanitizeContext(string $text): string
    {
        $text = preg_replace('/wire\s+payout/i', 'Transferred', $text);
        $text = preg_replace('/(?:in|for|from)?\s*Order\s*#[A-Za-z0-9_-]+/i', '', $text);
        $text = preg_replace('/#ORD-[A-Za-z0-9_-]+/i', '', $text);
        $text = preg_replace('/\bORD-[A-Za-z0-9_-]+\b/i', '', $text);
        $text = preg_replace('/\s+by\s+[A-Za-z0-9\s]+$/i', '', $text);
        $text = preg_replace('/^Sales\s+bonus\s*(?:for)?/i', 'Sold product', $text);
        $text = preg_replace('/Vendor stock payout for\s*/i', 'Sold: ', $text);
        $text = preg_replace('/\.?\s*Agreed vendor cut\.?/i', '', $text);
        $text = preg_replace('/\s+/', ' ', $text);

        return trim($text, " \t\n\r\0\x0B·-:,.") ?: 'Transaction entry';
    }

    /**
     * Generate an aggregated statement and ledger for a vendor/partner.
     *
     * @param  Contact  $contact
     * @param  string|null  $startDateStr
     * @param  string|null  $endDateStr
     * @return array<string, mixed>
     */
    public function execute(Contact $contact, ?string $startDateStr = null, ?string $endDateStr = null): array
    {
        $startDate = $startDateStr ? Carbon::parse($startDateStr)->startOfDay() : null;
        $endDate = $endDateStr ? Carbon::parse($endDateStr)->endOfDay() : null;

        // Fetch all debts and payments linked to this contact
        $debts = Debt::where('contact_id', $contact->id)
            ->with(['payments.financialAccount'])
            ->orderBy('created_at')
            ->get();

        // Preload associated SalesOrders and InventoryUnits for clean context descriptions
        $orderIds = $debts->whereIn('reference_type', ['sales_order', 'consignment_sale', 'brokered_sourcing', 'salesperson_bonus'])
            ->pluck('reference_id')
            ->filter()
            ->unique()
            ->values();

        $orders = SalesOrder::whereIn('id', $orderIds)
            ->with(['items.variant.product', 'items.inventoryUnit'])
            ->get()
            ->keyBy('id');

        $unitIds = $debts->whereIn('reference_type', ['handover_holding', 'vendor_repair_reimbursement', 'repair_reimbursement', 'vendor_return_refund'])
            ->pluck('reference_id')
            ->filter()
            ->unique()
            ->values();

        $inventoryUnits = InventoryUnit::whereIn('id', $unitIds)
            ->with(['variant.product'])
            ->get()
            ->keyBy('id');

        $rawEntries = [];

        foreach ($debts as $debt) {
            $debtCreatedDate = Carbon::parse($debt->created_at);
            $order = ! empty($debt->reference_id) ? ($orders->get($debt->reference_id) ?? null) : null;

            if ($debt->type === 'payable') {
                if ($debt->reference_type === 'consignment_sale') {
                    $itemDesc = 'Consignment Device';
                    if ($order && $order->items->isNotEmpty()) {
                        $itemDesc = $order->items->map(function ($it) {
                            $pName = $it->variant?->product?->name ?? 'Device';
                            $sn = $it->inventoryUnit?->imei_or_serial ? " (SN: {$it->inventoryUnit->imei_or_serial})" : '';
                            $qty = $it->quantity > 1 ? " x{$it->quantity}" : '';
                            return "{$pName}{$sn}{$qty}";
                        })->join(', ');
                    } elseif ($debt->notes) {
                        $itemDesc = $this->sanitizeContext($debt->notes);
                    }

                    $cleanContext = str_starts_with(strtolower($itemDesc), 'sold') ? $itemDesc : "Sold: {$itemDesc}";

                    $rawEntries[] = [
                        'id' => "debt-{$debt->id}",
                        'date' => $debtCreatedDate,
                        'type' => 'consignment_sale',
                        'type_label' => 'Consignment Sale',
                        'context' => $cleanContext,
                        'payable' => (float) $debt->original_amount,
                        'receivable' => 0.0,
                        'balance_effect' => - (float) $debt->original_amount,
                        'reference_number' => null,
                    ];
                } elseif ($debt->reference_type === 'salesperson_bonus') {
                    $itemDesc = 'Sold Product';
                    if ($order && $order->items->isNotEmpty()) {
                        $itemDesc = $order->items->map(function ($it) {
                            $pName = $it->variant?->product?->name ?? 'Device';
                            $sn = $it->inventoryUnit?->imei_or_serial ? " (SN: {$it->inventoryUnit->imei_or_serial})" : '';
                            $qty = $it->quantity > 1 ? " x{$it->quantity}" : '';
                            return "{$pName}{$sn}{$qty}";
                        })->join(', ');
                    } elseif ($debt->notes) {
                        $itemDesc = $this->sanitizeContext($debt->notes);
                    }

                    $cleanContext = str_starts_with(strtolower($itemDesc), 'sold') ? $itemDesc : "Sold: {$itemDesc}";

                    $rawEntries[] = [
                        'id' => "debt-{$debt->id}",
                        'date' => $debtCreatedDate,
                        'type' => 'salesperson_bonus',
                        'type_label' => 'Payable',
                        'context' => $cleanContext,
                        'payable' => (float) $debt->original_amount,
                        'receivable' => 0.0,
                        'balance_effect' => - (float) $debt->original_amount,
                        'reference_number' => null,
                    ];
                } elseif ($debt->reference_type === 'brokered_sourcing') {
                    $itemDesc = 'Brokered Item';
                    if ($order && $order->items->isNotEmpty()) {
                        $itemDesc = $order->items->map(function ($it) {
                            $pName = $it->variant?->product?->name ?? 'Device';
                            $sn = $it->inventoryUnit?->imei_or_serial ? " (SN: {$it->inventoryUnit->imei_or_serial})" : ' x1';
                            $qty = $it->quantity > 1 ? " x{$it->quantity}" : '';
                            return "{$pName}{$sn}{$qty}";
                        })->join(', ');
                    } elseif ($debt->notes) {
                        $itemDesc = $this->sanitizeContext($debt->notes);
                    }

                    $rawEntries[] = [
                        'id' => "debt-{$debt->id}",
                        'date' => $debtCreatedDate,
                        'type' => 'brokered_sourcing',
                        'type_label' => 'Item Received',
                        'context' => $itemDesc,
                        'payable' => (float) $debt->original_amount,
                        'receivable' => 0.0,
                        'balance_effect' => - (float) $debt->original_amount,
                        'reference_number' => null,
                    ];
                } elseif ($debt->reference_type === 'stock_intake') {
                    $unit = ! empty($debt->reference_id) ? ($inventoryUnits->get($debt->reference_id) ?? null) : null;
                    $pName = $unit?->variant?->product?->name ?? 'Device';
                    $sn = $unit?->imei_or_serial ? " (SN: {$unit->imei_or_serial})" : '';
                    $context = $unit ? "{$pName}{$sn}" : ($debt->notes ? $this->sanitizeContext($debt->notes) : 'Stock Received');

                    $rawEntries[] = [
                        'id' => "debt-{$debt->id}",
                        'date' => $debtCreatedDate,
                        'type' => 'stock_intake',
                        'type_label' => 'Item Received',
                        'context' => $context,
                        'payable' => (float) $debt->original_amount,
                        'receivable' => 0.0,
                        'balance_effect' => - (float) $debt->original_amount,
                        'reference_number' => null,
                    ];
                } else {
                    $rawEntries[] = [
                        'id' => "debt-{$debt->id}",
                        'date' => $debtCreatedDate,
                        'type' => 'manual_payable',
                        'type_label' => 'Payable',
                        'context' => $debt->notes ? $this->sanitizeContext($debt->notes) : 'Agreed payable balance',
                        'payable' => (float) $debt->original_amount,
                        'receivable' => 0.0,
                        'balance_effect' => - (float) $debt->original_amount,
                        'reference_number' => null,
                    ];
                }
            } else {
                // Receivable
                if ($debt->reference_type === 'sales_order') {
                    $itemDesc = 'Sales Credit';
                    if ($order && $order->items->isNotEmpty()) {
                        $itemDesc = $order->items->map(function ($it) {
                            $pName = $it->variant?->product?->name ?? 'Device';
                            $sn = $it->inventoryUnit?->imei_or_serial ? " (SN: {$it->inventoryUnit->imei_or_serial})" : '';
                            $qty = $it->quantity > 1 ? " x{$it->quantity}" : ' x1';
                            return "{$pName}{$sn}{$qty}";
                        })->join(', ');
                    } elseif ($debt->notes) {
                        $itemDesc = $this->sanitizeContext($debt->notes);
                    }

                    $rawEntries[] = [
                        'id' => "debt-{$debt->id}",
                        'date' => $debtCreatedDate,
                        'type' => 'sales_credit',
                        'type_label' => 'Sales Credit',
                        'context' => $itemDesc,
                        'payable' => 0.0,
                        'receivable' => (float) $debt->original_amount,
                        'balance_effect' => (float) $debt->original_amount,
                        'reference_number' => null,
                    ];
                } elseif ($debt->reference_type === 'handover_holding') {
                    $unit = ! empty($debt->reference_id) ? ($inventoryUnits->get($debt->reference_id) ?? null) : null;
                    if ($unit) {
                        $pName = $unit->variant?->product?->name ?? 'Device';
                        $sn = $unit->imei_or_serial ? " (SN: {$unit->imei_or_serial})" : '';
                        $context = "{$pName}{$sn}";
                    } elseif (preg_match('/(?:for\s+)([A-Za-z0-9_-]+)/i', $debt->notes ?? '', $m)) {
                        $context = "Device Handover (SN: {$m[1]})";
                    } else {
                        $context = 'Device Handover';
                    }

                    $rawEntries[] = [
                        'id' => "debt-{$debt->id}",
                        'date' => $debtCreatedDate,
                        'type' => 'handover_holding',
                        'type_label' => 'Device Handover',
                        'context' => $context,
                        'payable' => 0.0,
                        'receivable' => (float) $debt->original_amount,
                        'balance_effect' => (float) $debt->original_amount,
                        'reference_number' => null,
                    ];

                    if ($debt->payments->isEmpty() && str_contains($debt->notes ?? '', 'CANCELLED')) {
                        $rawEntries[] = [
                            'id' => "pay-cancel-{$debt->id}",
                            'date' => $debt->updated_at ? Carbon::parse($debt->updated_at) : $debtCreatedDate,
                            'type' => 'handover_return',
                            'type_label' => 'Device Returned',
                            'context' => 'Returned unsold to shop' . ($debt->notes ? " · {$debt->notes}" : ''),
                            'payable' => 0.0,
                            'receivable' => - (float) $debt->original_amount,
                            'balance_effect' => - (float) $debt->original_amount,
                            'reference_number' => 'RETURN-TO-SHOP',
                        ];
                    }
                } elseif ($debt->reference_type === 'vendor_advance_payout') {
                    // Handled uniformly in $directExpenses as "Payment Sent" with account details to avoid duplicate ledger entries
                    continue;
                } elseif ($debt->reference_type === 'repair_reimbursement' || $debt->reference_type === 'vendor_repair_reimbursement') {
                    $unit = ! empty($debt->reference_id) ? ($inventoryUnits->get($debt->reference_id) ?? null) : null;
                    $sn = $unit?->imei_or_serial ? " (SN: {$unit->imei_or_serial})" : '';
                    $rawEntries[] = [
                        'id' => "debt-{$debt->id}",
                        'date' => $debtCreatedDate,
                        'type' => 'repair_claim',
                        'type_label' => 'Repair Claim',
                        'context' => "Warranty repair claim{$sn}",
                        'payable' => 0.0,
                        'receivable' => (float) $debt->original_amount,
                        'balance_effect' => (float) $debt->original_amount,
                        'reference_number' => null,
                    ];
                } elseif ($debt->reference_type === 'vendor_return_refund') {
                    $unit = ! empty($debt->reference_id) ? ($inventoryUnits->get($debt->reference_id) ?? null) : null;
                    $pName = $unit?->variant?->product?->name ?? 'Device';
                    $sn = $unit?->imei_or_serial ? " (SN: {$unit->imei_or_serial})" : '';
                    $rawEntries[] = [
                        'id' => "debt-{$debt->id}",
                        'date' => $debtCreatedDate,
                        'type' => 'vendor_return',
                        'type_label' => 'Return Refund Claim',
                        'context' => "Refund owed for returned {$pName}{$sn}",
                        'payable' => 0.0,
                        'receivable' => (float) $debt->original_amount,
                        'balance_effect' => (float) $debt->original_amount,
                        'reference_number' => 'RETURN-REFUND',
                    ];
                } else {
                    $rawEntries[] = [
                        'id' => "debt-{$debt->id}",
                        'date' => $debtCreatedDate,
                        'type' => 'manual_receivable',
                        'type_label' => 'Receivable',
                        'context' => $debt->notes ?: 'Agreed credit receivable',
                        'payable' => 0.0,
                        'receivable' => (float) $debt->original_amount,
                        'balance_effect' => (float) $debt->original_amount,
                        'reference_number' => null,
                    ];
                }
            }

            // Downstream payments for this debt
            foreach ($debt->payments as $payment) {
                $payDate = $payment->payment_date ? Carbon::parse($payment->payment_date) : Carbon::parse($payment->created_at);
                $accountName = $payment->financialAccount?->name ?? 'Wire';

                if ($payment->reference_number === 'RETURN-TO-VENDOR') {
                    $rawEntries[] = [
                        'id' => "pay-{$payment->id}",
                        'date' => $payDate,
                        'type' => 'vendor_return',
                        'type_label' => 'Return',
                        'context' => 'Returned to vendor' . ($debt->notes ? " · {$debt->notes}" : ''),
                        'payable' => - (float) $payment->amount,
                        'receivable' => 0.0,
                        'balance_effect' => (float) $payment->amount,
                        'reference_number' => 'RETURN-TO-VENDOR',
                    ];
                } elseif ($payment->reference_number === 'REPAIR-OFFSET') {
                    $rawEntries[] = [
                        'id' => "pay-{$payment->id}",
                        'date' => $payDate,
                        'type' => 'repair_offset',
                        'type_label' => 'Repair Deduction',
                        'context' => 'Repair cost deduction',
                        'payable' => - (float) $payment->amount,
                        'receivable' => 0.0,
                        'balance_effect' => (float) $payment->amount,
                        'reference_number' => 'REPAIR-OFFSET',
                    ];
                } elseif ($payment->reference_number === 'RETURN-TO-SHOP') {
                    $rawEntries[] = [
                        'id' => "pay-{$payment->id}",
                        'date' => $payDate,
                        'type' => 'handover_return',
                        'type_label' => 'Device Returned',
                        'context' => 'Returned unsold to shop' . ($debt->notes ? " · {$debt->notes}" : ''),
                        'payable' => 0.0,
                        'receivable' => - (float) $payment->amount,
                        'balance_effect' => - (float) $payment->amount,
                        'reference_number' => 'RETURN-TO-SHOP',
                    ];
                } elseif ($payment->reference_number === 'BILATERAL-OFFSET') {
                    $rawEntries[] = [
                        'id' => "pay-{$payment->id}",
                        'date' => $payDate,
                        'type' => 'bilateral_offset',
                        'type_label' => 'Bilateral Offset',
                        'context' => $payment->notes ?: 'Settled via bilateral offset / trade',
                        'payable' => $debt->type === 'payable' ? - (float) $payment->amount : 0.0,
                        'receivable' => $debt->type === 'receivable' ? - (float) $payment->amount : 0.0,
                        'balance_effect' => $debt->type === 'payable' ? (float) $payment->amount : - (float) $payment->amount,
                        'reference_number' => 'BILATERAL-OFFSET',
                    ];
                } elseif ($payment->reference_number === 'OFFSET-INTAKE' || $payment->reference_number === 'DEVICE-OFFSET' || str_contains($payment->notes ?? '', 'device') || str_contains($payment->notes ?? '', 'Offset') || str_contains($payment->notes ?? '', 'Paid by device')) {
                    $rawEntries[] = [
                        'id' => "pay-{$payment->id}",
                        'date' => $payDate,
                        'type' => 'device_offset',
                        'type_label' => 'Paid by Device',
                        'context' => $payment->notes ?: 'Paid by device intake offset',
                        'payable' => $debt->type === 'payable' ? - (float) $payment->amount : 0.0,
                        'receivable' => $debt->type === 'receivable' ? - (float) $payment->amount : 0.0,
                        'balance_effect' => $debt->type === 'payable' ? (float) $payment->amount : - (float) $payment->amount,
                        'reference_number' => 'DEVICE-OFFSET',
                    ];
                } elseif ($debt->type === 'payable') {
                    $accText = ($accountName && $accountName !== 'Wire') ? " ({$accountName})" : '';
                    $cleanPayRef = ($payment->reference_number && !str_starts_with($payment->reference_number, 'ORD-')) ? $payment->reference_number : null;
                    $rawEntries[] = [
                        'id' => "pay-{$payment->id}",
                        'date' => $payDate,
                        'type' => 'payment_sent',
                        'type_label' => 'Payment Sent',
                        'context' => "Transferred{$accText}",
                        'payable' => - (float) $payment->amount,
                        'receivable' => 0.0,
                        'balance_effect' => (float) $payment->amount,
                        'reference_number' => $cleanPayRef,
                    ];
                } else {
                    $isRepair = in_array($debt->reference_type, ['repair_reimbursement', 'vendor_repair_reimbursement']);
                    $rawEntries[] = [
                        'id' => "pay-{$payment->id}",
                        'date' => $payDate,
                        'type' => 'payment_received',
                        'type_label' => $isRepair ? 'Repair Payment' : 'Payment Received',
                        'context' => $isRepair ? "Repair payment ({$accountName})" : "Payment received ({$accountName})",
                        'payable' => 0.0,
                        'receivable' => - (float) $payment->amount,
                        'balance_effect' => - (float) $payment->amount,
                        'reference_number' => $payment->reference_number,
                    ];
                }
            }
        }

        // Customer purchases (sales orders where this contact is the buyer and no credit debt exists)
        $creditOrderIds = $debts->where('reference_type', 'sales_order')->pluck('reference_id')->filter()->all();
        $customerOrders = SalesOrder::where('customer_id', $contact->id)
            ->whereNotIn('id', $creditOrderIds)
            ->with(['items.variant.product', 'items.inventoryUnit', 'financialAccount', 'exchangeUnit.variant.product'])
            ->get();

        foreach ($customerOrders as $co) {
            $total = (float) $co->total_amount;
            if ($total <= 0) {
                continue;
            }
            $orderDate = Carbon::parse($co->order_date ?? $co->created_at);
            $itemDesc = $co->items->isNotEmpty()
                ? $co->items->map(function ($it) {
                    $pName = $it->variant?->product?->name ?? 'Item';
                    $sn = $it->inventoryUnit?->imei_or_serial ? " (SN: {$it->inventoryUnit->imei_or_serial})" : '';
                    $qty = $it->quantity > 1 ? " x{$it->quantity}" : '';
                    return "{$pName}{$sn}{$qty}";
                })->join(', ')
                : 'Purchase';

            $rawEntries[] = [
                'id' => "order-{$co->id}",
                'date' => $orderDate,
                'type' => 'customer_purchase',
                'type_label' => 'Purchase',
                'context' => $itemDesc,
                'payable' => 0.0,
                'receivable' => $total,
                'balance_effect' => $total,
                'reference_number' => null,
            ];

            $tradeIn = min($total, (float) ($co->exchange_allowance ?? 0));
            $paid = min($total - $tradeIn, (float) $co->paid_amount);
            if ($paid > 0) {
                $acc = $co->financialAccount?->name;
                $rawEntries[] = [
                    'id' => "order-pay-{$co->id}",
                    'date' => $orderDate,
                    'type' => 'payment_received',
                    'type_label' => 'Payment Received',
                    'context' => $acc ? "Paid ({$acc})" : 'Paid',
                    'payable' => 0.0,
                    'receivable' => -$paid,
                    'balance_effect' => -$paid,
                    'reference_number' => null,
                ];
            }
            if ($tradeIn > 0) {
                $xUnit = $co->exchangeUnit;
                $xName = $xUnit?->variant?->product?->name ?? 'Device';
                $xSn = $xUnit?->imei_or_serial ? " (IMEI: {$xUnit->imei_or_serial})" : '';
                $rawEntries[] = [
                    'id' => "order-tradein-{$co->id}",
                    'date' => $orderDate,
                    'type' => 'device_offset',
                    'type_label' => 'Paid by Device',
                    'context' => "Trade-in: {$xName}{$xSn}",
                    'payable' => 0.0,
                    'receivable' => -$tradeIn,
                    'balance_effect' => -$tradeIn,
                    'reference_number' => null,
                ];
            }
        }

        // Units supplied by this vendor that do not have an existing debt record (e.g. stocked directly)
        $existingStockIntakeUnitIds = $debts->where('reference_type', 'stock_intake')->pluck('reference_id')->filter()->all();
        $consignmentOrderIds = $debts->where('reference_type', 'consignment_sale')->pluck('reference_id')->filter()->all();
        $soldUnitIdsWithDebt = \App\Models\SalesOrderItem::whereIn('sales_order_id', $consignmentOrderIds)
            ->whereNotNull('inventory_unit_id')
            ->pluck('inventory_unit_id')
            ->all();

        $brokeredOrderIds = $debts->where('reference_type', 'brokered_sourcing')->pluck('reference_id')->filter()->all();
        $brokeredUnitIds = \App\Models\SalesOrderItem::whereIn('sales_order_id', $brokeredOrderIds)
            ->whereNotNull('inventory_unit_id')
            ->pluck('inventory_unit_id')
            ->all();

        $vendorDirectSaleUnitIds = $debts->where('reference_type', 'vendor_direct_sale')->pluck('reference_id')->filter()->all();

        $allDebtedUnitIds = array_unique(array_merge(
            $existingStockIntakeUnitIds,
            $soldUnitIdsWithDebt,
            $brokeredUnitIds,
            $vendorDirectSaleUnitIds
        ));

        $vendorUnitsWithoutDebt = InventoryUnit::where('supplier_contact_id', $contact->id)
            ->where('cost_basis', '>', 0)
            ->whereNotIn('source_type', ['exchange', 'vendor_direct'])
            ->whereNull('exchange_sales_order_id')
            ->whereNotIn('id', $allDebtedUnitIds)
            ->where(function ($q) {
                $q->whereNull('funding_source')
                    ->orWhere('funding_source', 'none');
            })
            ->with(['variant.product'])
            ->get()
            ->filter(function ($u) use ($debts) {
                if ($u->source_type === 'exchange' || $u->source_type === 'vendor_direct' || ! empty($u->exchange_sales_order_id)) {
                    return false;
                }
                if ($u->imei_or_serial) {
                    foreach ($debts as $d) {
                        if ($d->notes && str_contains($d->notes, $u->imei_or_serial)) {
                            return false;
                        }
                    }
                }
                return true;
            });

        foreach ($vendorUnitsWithoutDebt as $unit) {
            $pName = $unit->variant?->product?->name ?? 'Device';
            $sn = $unit->imei_or_serial ? " (SN: {$unit->imei_or_serial})" : '';
            $rawEntries[] = [
                'id' => "unit-intake-{$unit->id}",
                'date' => Carbon::parse($unit->created_at),
                'type' => 'stock_intake',
                'type_label' => 'Item Received',
                'context' => "{$pName}{$sn}",
                'payable' => (float) $unit->cost_basis,
                'receivable' => 0.0,
                'balance_effect' => - (float) $unit->cost_basis,
                'reference_number' => null,
            ];

            if ($unit->status === 'returned_to_vendor' && $unit->returned_at) {
                $rawEntries[] = [
                    'id' => "unit-return-{$unit->id}",
                    'date' => Carbon::parse($unit->returned_at),
                    'type' => 'vendor_return',
                    'type_label' => 'Return',
                    'context' => "Returned to vendor · {$pName}{$sn}",
                    'payable' => - (float) $unit->cost_basis,
                    'receivable' => 0.0,
                    'balance_effect' => (float) $unit->cost_basis,
                    'reference_number' => 'RETURN-TO-VENDOR',
                ];
            }
        }

        // Direct expenses paid to this vendor (if not already recorded as debt payment)
        $directExpenses = \App\Models\Expense::where('tenant_id', $contact->tenant_id)
            ->where('vendor_contact_id', $contact->id)
            ->whereNull('inventory_unit_id')
            ->with('financialAccount')
            ->get();

        $existingPayRefs = collect($rawEntries)
            ->pluck('reference_number')
            ->filter()
            ->all();

        foreach ($directExpenses as $exp) {
            $expRef = "EXP-{$exp->id}";
            if (! in_array($expRef, $existingPayRefs)) {
                $acc = $exp->financialAccount?->name ?? '';
                $accText = ($acc && $acc !== 'Wire') ? " ({$acc})" : '';
                $expDesc = $exp->description ? $this->sanitizeContext($exp->description) : "Transferred{$accText}";
                $rawEntries[] = [
                    'id' => "exp-{$exp->id}",
                    'date' => Carbon::parse($exp->date ?? $exp->created_at),
                    'type' => 'payment_sent',
                    'type_label' => 'Payment Sent',
                    'context' => $expDesc,
                    'payable' => - (float) $exp->amount,
                    'receivable' => 0.0,
                    'balance_effect' => (float) $exp->amount,
                    'reference_number' => null,
                ];
            }
        }

        // Sort all raw transactions chronologically
        usort($rawEntries, fn ($a, $b) => $a['date']->getTimestamp() <=> $b['date']->getTimestamp());

        // Separate balance prior to $startDate vs within range
        $openingBalance = 0.0;
        $inRangeEntries = [];

        foreach ($rawEntries as $entry) {
            $entryDate = $entry['date'];

            if ($startDate && $entryDate->lt($startDate)) {
                $openingBalance += $entry['balance_effect'];
            } elseif ($endDate && $entryDate->gt($endDate)) {
                // Future beyond range, skip
                continue;
            } else {
                $inRangeEntries[] = $entry;
            }
        }

        // Calculate running balance through in-range entries
        $runningBalance = $openingBalance;
        $ledger = [];

        if ($startDate && count($rawEntries) > 0) {
            $ledger[] = [
                'id' => 'opening-balance',
                'date' => $startDate->toIso8601String(),
                'formatted_date' => $startDate->format('M d, Y'),
                'type' => 'opening_balance',
                'type_label' => 'Balance Forward',
                'context' => 'Opening balance brought forward prior to statement range',
                'payable' => 0.0,
                'receivable' => 0.0,
                'balance_effect' => 0.0,
                'running_balance' => round($openingBalance, 2),
                'reference_number' => null,
            ];
        }

        $rangePayableSum = 0.0;
        $rangeReceivableSum = 0.0;
        $rangePaidSentSum = 0.0;
        $rangeReceivedSum = 0.0;

        foreach ($inRangeEntries as $entry) {
            $runningBalance += $entry['balance_effect'];

            if ($entry['type'] === 'consignment_sale' || $entry['type'] === 'brokered_sourcing' || $entry['type'] === 'stock_intake' || $entry['type'] === 'manual_payable') {
                $rangePayableSum += $entry['payable'];
            } elseif ($entry['type'] === 'payment_sent' || $entry['type'] === 'repair_offset' || $entry['type'] === 'vendor_return') {
                $rangePaidSentSum += abs($entry['payable']);
            } elseif ($entry['type'] === 'sales_credit' || $entry['type'] === 'handover_holding' || $entry['type'] === 'repair_claim' || $entry['type'] === 'payout_advance' || $entry['type'] === 'manual_receivable' || $entry['type'] === 'customer_purchase') {
                $rangeReceivableSum += $entry['receivable'];
            } elseif ($entry['type'] === 'payment_received' || $entry['type'] === 'device_offset' || $entry['type'] === 'bilateral_offset') {
                if ($entry['receivable'] < 0) {
                    $rangeReceivedSum += abs($entry['receivable']);
                }
                if ($entry['payable'] < 0) {
                    $rangePaidSentSum += abs($entry['payable']);
                }
            }

            $ledger[] = [
                'id' => $entry['id'],
                'date' => $entry['date']->toIso8601String(),
                'formatted_date' => $entry['date']->format('M d, Y'),
                'type' => $entry['type'],
                'type_label' => $entry['type_label'],
                'context' => $entry['context'],
                'payable' => round($entry['payable'], 2),
                'receivable' => round($entry['receivable'], 2),
                'balance_effect' => round($entry['balance_effect'], 2),
                'running_balance' => round($runningBalance, 2),
                'reference_number' => $entry['reference_number'],
            ];
        }

        // Current overall status (all-time open)
        $currentOpenPayable = (float) Debt::where('contact_id', $contact->id)
            ->where('type', 'payable')
            ->whereIn('status', ['open', 'partially_paid'])
            ->sum('remaining_amount');

        $unDebtStockPayable = (float) InventoryUnit::where('supplier_contact_id', $contact->id)
            ->where('status', 'in_stock')
            ->whereNotIn('source_type', ['exchange', 'vendor_direct'])
            ->whereNull('exchange_sales_order_id')
            ->whereNotIn('id', $allDebtedUnitIds)
            ->where(function ($q) {
                $q->whereNull('funding_source')
                    ->orWhere('funding_source', 'none');
            })
            ->sum('cost_basis');

        $currentOpenPayable += $unDebtStockPayable;

        $currentOpenReceivable = (float) Debt::where('contact_id', $contact->id)
            ->where('type', 'receivable')
            ->whereIn('status', ['open', 'partially_paid'])
            ->sum('remaining_amount');

        $currentNetBalance = $currentOpenReceivable - $currentOpenPayable;

        // Inventory Breakdown for Tabs
        $suppliedUnits = InventoryUnit::where('supplier_contact_id', $contact->id)
            ->with(['variant.product', 'salesOrderItem.salesOrder'])
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($u) {
                return [
                    'id' => $u->id,
                    'model' => $u->variant?->product?->name ?? 'Device',
                    'specs' => array_filter([$u->variant?->storage, $u->variant?->color]),
                    'imei_or_serial' => $u->imei_or_serial,
                    'status' => $u->status,
                    'location' => $u->location,
                    'cost_basis' => (float) $u->cost_basis,
                    'selling_price' => (float) $u->selling_price,
                    'source_type' => $u->source_type,
                    'created_at' => $u->created_at->toIso8601String(),
                    'sold_at' => $u->sold_at?->toIso8601String(),
                    'order_number' => null,
                ];
            });

        // Units out on handover with this partner
        $handedOutUnits = InventoryUnit::where('handover_to', $contact->name)
            ->where('status', 'out')
            ->with(['variant.product'])
            ->get()
            ->map(function ($u) {
                return [
                    'id' => $u->id,
                    'model' => $u->variant?->product?->name ?? 'Device',
                    'specs' => array_filter([$u->variant?->storage, $u->variant?->color]),
                    'imei_or_serial' => $u->imei_or_serial,
                    'status' => $u->status,
                    'location' => $u->location,
                    'handed_out_at' => $u->handed_out_at?->toIso8601String(),
                    'handover_payout' => (float) $u->handover_payout,
                ];
            });

        // Units with vendor for repair/warranty
        $vendorReturnUnits = InventoryUnit::where('supplier_contact_id', $contact->id)
            ->whereIn('status', ['returned_to_vendor', 'fixed'])
            ->with(['variant.product', 'maintenanceRecords'])
            ->get()
            ->map(function ($u) {
                return [
                    'id' => $u->id,
                    'model' => $u->variant?->product?->name ?? 'Device',
                    'specs' => array_filter([$u->variant?->storage, $u->variant?->color]),
                    'imei_or_serial' => $u->imei_or_serial,
                    'status' => $u->status,
                    'return_reason' => $u->return_reason,
                    'returned_at' => $u->returned_at?->toIso8601String(),
                    'maintenance_cost' => (float) $u->maintenanceRecords->sum('cost'),
                ];
            });

        return [
            'contact' => [
                'id' => $contact->id,
                'name' => $contact->name,
                'phone' => $contact->phone,
                'alt_phone' => $contact->alt_phone,
                'email' => $contact->email,
                'roles' => $contact->roles ?? [],
                'statement_token' => $contact->statement_token,
            ],
            'range' => [
                'start_date' => $startDate?->toDateString(),
                'end_date' => $endDate?->toDateString(),
                'formatted_range' => ($startDate && $endDate)
                    ? "{$startDate->format('M d, Y')} - {$endDate->format('M d, Y')}"
                    : 'All Historical Records',
            ],
            'kpis' => [
                'current_open_payable' => round($currentOpenPayable, 2),
                'current_open_receivable' => round($currentOpenReceivable, 2),
                'current_net_balance' => round($currentNetBalance, 2),
                'balance_verdict' => $currentNetBalance > 0
                    ? 'Receivable (Partner owes us)'
                    : ($currentNetBalance < 0 ? 'Payable (We owe partner)' : 'Settled (0.00 ETB)'),

                'range_opening_balance' => round($openingBalance, 2),
                'range_closing_balance' => round($runningBalance, 2),
                'range_payable_total' => round($rangePayableSum, 2),
                'range_receivable_total' => round($rangeReceivableSum, 2),
                'range_paid_to_vendor' => round($rangePaidSentSum, 2),
                'range_received_from_vendor' => round($rangeReceivedSum, 2),

                'supplied_units_count' => $suppliedUnits->count(),
                'supplied_in_stock_count' => $suppliedUnits->where('status', 'in_stock')->count(),
                'handed_out_count' => $handedOutUnits->count(),
                'repairs_count' => $vendorReturnUnits->count(),
            ],
            'business' => (function () use ($contact) {
                $tenant = $contact->tenant;
                if (! $tenant && ! empty($contact->tenant_id)) {
                    $tenant = \App\Models\Tenant::find($contact->tenant_id);
                }
                $tenantSettings = $tenant?->settings ?? [];
                $ownerUser = $tenant?->users()->where('role', 'owner')->first();

                $addressParts = array_filter([
                    $tenantSettings['address'] ?? null,
                    $tenantSettings['city'] ?? null,
                ]);
                $branch = ! empty($addressParts) ? implode(', ', $addressParts) : ($tenant?->business_type ? ucfirst($tenant->business_type) : 'Addis Ababa');

                $businessName = ! empty($tenant?->name) ? $tenant->name : 'HabeshaBiz Electronics';
                $businessPhone = ! empty($tenant?->phone) ? $tenant->phone : '+251 91 123 4567';
                $businessEmail = ! empty($ownerUser?->email) ? $ownerUser->email : 'sales@habeshabiz.et';
                $businessLogo = $tenantSettings['logo_url'] ?? null;

                return [
                    'name' => $businessName,
                    'branch' => $branch,
                    'phone' => $businessPhone,
                    'email' => $businessEmail,
                    'logo_url' => $businessLogo,
                    'tin_number' => $tenantSettings['tin_number'] ?? null,
                    'footer_note' => $tenantSettings['footer_note'] ?? null,
                    'bank_accounts' => \App\Models\FinancialAccount::where('tenant_id', $contact->tenant_id)
                        ->where('is_active', true)
                        ->whereIn('type', ['bank', 'mobile_money'])
                        ->get(['id', 'name', 'account_number', 'type', 'logo'])
                        ->toArray(),
                ];
            })(),
            'ledger' => $ledger,
            'supplied_units' => $suppliedUnits,
            'handed_out_units' => $handedOutUnits,
            'vendor_return_units' => $vendorReturnUnits,
        ];
    }
}
