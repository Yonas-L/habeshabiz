<?php

namespace App\Services;

class ProformaCalculationService
{
    /**
     * Compute full line item calculations and invoice summaries.
     *
     * @param  array  $rawItems  Array of raw item inputs
     * @param  array  $invoiceMeta  Overall invoice fields (vat_rate, withholding_rate, shipping_fee)
     * @return array [ 'items' => array, 'summary' => array ]
     */
    public function calculate(array $rawItems, array $invoiceMeta = []): array
    {
        $defaultVatRate = isset($invoiceMeta['vat_rate']) ? (float) $invoiceMeta['vat_rate'] : 15.00;
        $withholdingRate = isset($invoiceMeta['withholding_rate']) ? (float) $invoiceMeta['withholding_rate'] : 0.00;
        $shippingFee = isset($invoiceMeta['shipping_fee']) ? max(0, (float) $invoiceMeta['shipping_fee']) : 0.00;

        $calculatedItems = [];
        $itemNumber = 1;

        foreach ($rawItems as $raw) {
            $qty = max(0.01, (float) ($raw['quantity'] ?? 1));
            $unitPrice = max(0, (float) ($raw['unit_price'] ?? 0));
            $subtotal = round($qty * $unitPrice, 2);

            $discountType = ($raw['discount_type'] ?? 'percentage') === 'fixed' ? 'fixed' : 'percentage';
            $discountRate = max(0, (float) ($raw['discount_rate'] ?? 0));

            if ($discountType === 'percentage') {
                $discountAmount = round($subtotal * (min(100, $discountRate) / 100), 2);
            } else {
                $discountAmount = min($subtotal, round($discountRate, 2));
            }

            $taxableAmount = max(0, round($subtotal - $discountAmount, 2));

            // Per-item tax rate, falls back to invoice default
            $taxRate = isset($raw['tax_rate']) && $raw['tax_rate'] !== null && $raw['tax_rate'] !== ''
                ? max(0, (float) $raw['tax_rate'])
                : $defaultVatRate;

            $taxAmount = round($taxableAmount * ($taxRate / 100), 2);
            $lineTotal = round($taxableAmount + $taxAmount, 2);

            $calculatedItems[] = [
                'item_number' => (int) ($raw['item_number'] ?? $itemNumber),
                'product_id' => $raw['product_id'] ?? null,
                'variant_id' => $raw['variant_id'] ?? null,
                'description' => trim((string) ($raw['description'] ?? 'Item')),
                'sku' => ! empty($raw['sku']) ? trim((string) $raw['sku']) : null,
                'unit_of_measure' => ! empty($raw['unit_of_measure']) ? trim((string) $raw['unit_of_measure']) : 'Pcs',
                'quantity' => $qty,
                'unit_price' => $unitPrice,
                'subtotal' => $subtotal,
                'discount_type' => $discountType,
                'discount_rate' => $discountRate,
                'discount_amount' => $discountAmount,
                'tax_rate' => $taxRate,
                'taxable_amount' => $taxableAmount,
                'tax_amount' => $taxAmount,
                'line_total' => $lineTotal,
            ];

            $itemNumber++;
        }

        $subtotalSum = round(array_sum(array_column($calculatedItems, 'subtotal')), 2);
        $discountSum = round(array_sum(array_column($calculatedItems, 'discount_amount')), 2);
        $taxableSum = round(array_sum(array_column($calculatedItems, 'taxable_amount')), 2);
        $vatSum = round(array_sum(array_column($calculatedItems, 'tax_amount')), 2);

        // Withholding Tax (WHT): in Ethiopia, withholding tax is 1.5% or 2% deducted from taxable amount before VAT
        $withholdingTotal = round($taxableSum * ($withholdingRate / 100), 2);

        // Gross total is taxable amount + VAT + shipping
        $grossTotal = round($taxableSum + $vatSum + $shippingFee, 2);

        // Net payable is gross total minus withholding deduction
        $netPayable = max(0, round($grossTotal - $withholdingTotal, 2));

        return [
            'items' => $calculatedItems,
            'summary' => [
                'subtotal' => $subtotalSum,
                'discount_total' => $discountSum,
                'taxable_amount' => $taxableSum,
                'vat_rate' => $defaultVatRate,
                'vat_total' => $vatSum,
                'withholding_rate' => $withholdingRate,
                'withholding_total' => $withholdingTotal,
                'shipping_fee' => $shippingFee,
                'total_amount' => $grossTotal,
                'net_payable' => $netPayable,
            ],
        ];
    }
}
