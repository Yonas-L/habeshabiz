<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{{ $filename ?? 'Sales Invoice' }}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 8mm 12mm 10mm 12mm;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 11px;
            line-height: 1.4;
            color: #0f172a;
            background-color: #ffffff;
            padding: 0;
        }

        /* ─── Corporate Letterhead ─── */
        .letterhead {
            display: table;
            width: 100%;
            table-layout: fixed;
            padding-bottom: 10px;
            border-bottom: 2px solid #0f172a;
            margin-bottom: 12px;
        }

        .brand-section {
            display: table-cell;
            vertical-align: top;
            width: 60%;
        }

        .brand-layout-table {
            border-collapse: collapse;
            margin: 0;
            padding: 0;
            border: none;
        }

        .brand-layout-table td {
            vertical-align: top;
            padding: 0;
            border: none;
        }

        .brand-logo {
            max-height: 56px;
            max-width: 170px;
            object-fit: contain;
            border-radius: 8px;
        }

        .brand-logo-fallback {
            width: 48px;
            height: 48px;
            background-color: #0f172a;
            color: #ffffff;
            border-radius: 10px;
            display: block;
            text-align: center;
            line-height: 48px;
            font-size: 17px;
            font-weight: 800;
            letter-spacing: -0.5px;
        }

        .brand-info {
            display: block;
        }

        .company-name {
            font-size: 13pt;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: -0.2px;
            color: #0f172a;
            line-height: 1.2;
        }

        .company-meta {
            font-size: 10px;
            color: #64748b;
            display: block;
            margin-top: 3px;
            font-weight: 400;
            line-height: 1.35;
        }

        .doc-title-section {
            display: table-cell;
            vertical-align: top;
            width: 40%;
            text-align: right;
        }

        .doc-badge {
            display: inline-block;
            font-size: 11pt;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: #0f172a;
        }

        .doc-order-num {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 11px;
            font-weight: 700;
            color: #475569;
            margin-top: 2px;
        }

        .doc-date {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 10px;
            color: #94a3b8;
            margin-top: 2px;
        }

        /* ─── Customer & Financial Position Strip ─── */
        .position-strip {
            display: table;
            width: 100%;
            table-layout: fixed;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 12px;
            break-inside: avoid;
            page-break-inside: avoid;
        }

        .customer-info {
            display: table-cell;
            vertical-align: middle;
            width: 55%;
        }

        .customer-label {
            font-size: 9.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #94a3b8;
            display: block;
            margin-bottom: 2px;
        }

        .customer-name {
            font-size: 13pt;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.2px;
            line-height: 1.2;
            margin-bottom: 2px;
        }

        .customer-meta {
            font-size: 10.5px;
            color: #475569;
            display: block;
        }

        .role-tag {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 2px 6px;
            border-radius: 4px;
            background-color: #e2e8f0;
            color: #334155;
            display: inline-block;
            vertical-align: middle;
            margin-left: 4px;
        }

        .balance-box {
            display: table-cell;
            vertical-align: middle;
            width: 45%;
            text-align: right;
        }

        .balance-verdict {
            display: inline-flex;
            align-items: center;
            justify-content: flex-end;
            gap: 5px;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .status-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            display: inline-block;
        }

        .status-paid { color: #047857; }
        .status-paid .status-dot { background-color: #10b981; }

        .status-credit { color: #d97706; }
        .status-credit .status-dot { background-color: #f59e0b; }

        .status-refunded { color: #be123c; }
        .status-refunded .status-dot { background-color: #f43f5e; }

        .status-offset { color: #4338ca; }
        .status-offset .status-dot { background-color: #6366f1; }

        .balance-amount {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 16pt;
            font-weight: 800;
            letter-spacing: -0.3px;
            font-variant-numeric: tabular-nums;
        }

        .currency-tag {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 11px;
            font-weight: 600;
            color: #94a3b8;
            margin-left: 4px;
        }

        /* ─── Table Section ─── */
        .section-header {
            display: table;
            width: 100%;
            margin-bottom: 12px;
        }

        .section-title {
            display: table-cell;
            vertical-align: middle;
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #0f172a;
        }

        .section-count {
            display: table-cell;
            vertical-align: middle;
            text-align: right;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 11px;
            font-weight: 400;
            color: #64748b;
            text-transform: uppercase;
        }

        table.items-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            table-layout: fixed;
            margin-bottom: 14px;
        }

        table.items-table thead {
            display: table-header-group;
        }

        table.items-table thead tr {
            border-bottom: 2px solid #0f172a;
            background-color: #f8fafc;
        }

        table.items-table th {
            padding: 9px 8px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            color: #0f172a;
            text-align: left;
            white-space: nowrap;
        }

        table.items-table th.col-qty {
            text-align: center;
        }

        table.items-table th.col-price,
        table.items-table th.col-total {
            text-align: right;
        }

        table.items-table tbody tr {
            background-color: #ffffff;
            break-inside: avoid;
            page-break-inside: avoid;
        }

        table.items-table td {
            padding: 9px 8px;
            border-bottom: 1px solid #f1f5f9;
            vertical-align: top;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }

        .col-index {
            text-align: center;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            color: #94a3b8;
            font-size: 10.5px;
        }

        .item-name {
            font-weight: 700;
            color: #0f172a;
            font-size: 11.5px;
        }

        .item-spec {
            font-weight: 400;
            color: #64748b;
            font-size: 10.5px;
            margin-left: 4px;
        }

        .item-hardware-tags {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 4px 8px;
            margin-top: 3px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 9.5px;
            color: #64748b;
        }

        .sn-badge {
            color: #047857;
            font-weight: 700;
        }

        .col-qty {
            text-align: center;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-weight: 700;
            color: #0f172a;
            font-size: 11.5px;
        }

        .col-price {
            text-align: right;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-variant-numeric: tabular-nums;
            color: #475569;
            font-size: 11.5px;
            white-space: nowrap;
        }

        .col-total {
            text-align: right;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-variant-numeric: tabular-nums;
            font-weight: 800;
            color: #0f172a;
            font-size: 11.5px;
            white-space: nowrap;
        }

        /* ─── Financial Settlement Breakdown ─── */
        .financial-summary-grid {
            width: 100%;
            margin-bottom: 14px;
            break-inside: avoid;
            page-break-inside: avoid;
        }

        .financial-card {
            width: 320px;
            margin-left: auto;
            margin-right: 0;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 14px;
        }

        .fin-row {
            display: table;
            width: 100%;
            table-layout: fixed;
            font-size: 10.5px;
            padding: 2.5px 0;
            color: #475569;
        }

        .fin-row > span:first-child {
            display: table-cell;
            text-align: left;
            vertical-align: middle;
        }

        .fin-row > span.fin-num,
        .fin-row > span:last-child {
            display: table-cell;
            text-align: right;
            vertical-align: middle;
        }

        .fin-row.total-row {
            border-top: 1.5px solid #0f172a;
            padding-top: 6px;
            margin-top: 4px;
            font-size: 12px;
            font-weight: 800;
            color: #0f172a;
        }

        .fin-num {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-variant-numeric: tabular-nums;
        }

        /* ─── Order Notes ─── */
        .notes-card {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 8px 12px;
            margin-bottom: 14px;
            font-size: 10px;
            break-inside: avoid;
            page-break-inside: avoid;
        }

        .notes-title {
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #64748b;
            margin-bottom: 3px;
        }

        /* ─── Official Verification Seal & Minimal Signature Line ─── */
        .official-seal-footer {
            margin-top: 20px;
            padding-top: 16px;
            border-top: 2px solid #0f172a;
            display: table;
            width: 100%;
            table-layout: fixed;
            break-inside: avoid;
            page-break-inside: avoid;
        }

        .seal-info {
            display: table-cell;
            vertical-align: bottom;
            width: 60%;
        }

        .signature-box {
            display: table-cell;
            vertical-align: bottom;
            width: 40%;
            text-align: right;
            position: relative;
        }

        .signature-img-wrap {
            height: 48px;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            margin-bottom: 2px;
        }

        .signature-img-wrap img {
            max-height: 46px;
            max-width: 180px;
            object-fit: contain;
        }

        .stamp-inplace-wrap {
            position: absolute;
            right: 0px;
            bottom: -10px;
            width: 80px;
            height: 80px;
            pointer-events: none;
            opacity: 0.92;
        }

        .stamp-inplace-wrap img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        /* ─── Free-floating Movable & Resizable Overlay ─── */
        .movable-asset {
            position: absolute;
            transform: translate(-50%, -50%);
            z-index: 50;
            pointer-events: none;
        }

        .movable-asset img {
            width: 100%;
            height: auto;
            object-fit: contain;
        }

        .signature-line {
            border-bottom: 2px solid #0f172a;
            padding-bottom: 4px;
            text-align: center;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 10px;
            font-weight: 700;
            color: #334155;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }
    </style>
</head>
<body>

    <!-- ═══ 1. CORPORATE LETTERHEAD ═══ -->
    <div class="letterhead">
        <div class="brand-section">
            <table class="brand-layout-table">
                <tr>
                    <td style="padding-right: 14px;">
                        @if(!empty($business['logo_base64']))
                            <img src="{{ $business['logo_base64'] }}" alt="{{ $business['name'] }}" class="brand-logo">
                        @else
                            <div class="brand-logo-fallback">
                                {{ strtoupper(substr($business['name'] ?? 'H', 0, 2)) }}
                            </div>
                        @endif
                    </td>
                    <td>
                        <div class="brand-info">
                            <div class="company-name">{{ $business['name'] }}</div>
                            <div class="company-meta">
                                @if(!empty($business['branch']))
                                    <div>{{ $business['branch'] }}</div>
                                @endif
                                @if(!empty($business['phone']))
                                    <div>{{ $business['phone'] }}</div>
                                @endif
                                @if(!empty($business['email']))
                                    <div>{{ $business['email'] }}</div>
                                @endif
                                @if(!empty($business['tin_number']))
                                    <div style="font-family: monospace;">TIN: {{ $business['tin_number'] }}</div>
                                @endif
                            </div>
                        </div>
                    </td>
                </tr>
            </table>
        </div>

        <div class="doc-title-section">
            <div class="doc-badge">{{ $isB2B ? 'B2B Trade Voucher' : 'Sales Invoice & Receipt' }}</div>
            <div class="doc-order-num">#{{ $order->order_number }}</div>
            <div class="doc-date">
                {{ \Carbon\Carbon::parse($order->order_date)->format('d/m/Y') }}
                @if($order->order_date)
                    · {{ \Carbon\Carbon::parse($order->order_date)->format('h:i A') }}
                @endif
            </div>
        </div>
    </div>

    <!-- ═══ 2. CUSTOMER & FINANCIAL POSITION STRIP ═══ -->
    <div class="position-strip">
        <div class="customer-info">
            <span class="customer-label">{{ $isB2B ? 'Trade Partner / Vendor' : 'Customer Account' }}</span>
            <div class="customer-name">{{ $order->customer?->name ?? ($isB2B ? 'Trade Partner' : 'Walk-in Customer') }}</div>
            <div class="customer-meta">
                @if(!empty($order->customer?->phone))
                    <span>{{ $order->customer->phone }}</span>
                @endif
                @if($isB2B)
                    <span class="role-tag">B2B Partner</span>
                @endif
                @if(!empty($order->salesperson?->name))
                    <span>· Attendant: {{ $order->salesperson->name }}</span>
                @endif
            </div>
        </div>

        <div class="balance-box">
            @php
                $statusClass = match(true) {
                    $isRefunded => 'status-refunded',
                    $isPaid && $isOffset => 'status-offset',
                    $isPaid => 'status-paid',
                    default => 'status-credit',
                };
                $statusLabel = match(true) {
                    $isRefunded => 'Refunded / Returned',
                    $isPaid && $isOffset => 'Settled via Offset',
                    $isPaid => 'Paid in Full',
                    default => 'Balance Outstanding',
                };
            @endphp
            <div class="balance-verdict {{ $statusClass }}">
                <span class="status-dot"></span>
                <span>{{ $statusLabel }}</span>
            </div>
            <div class="balance-amount {{ $statusClass }}">
                {{ number_format($settledSaleValue, 2) }}<span class="currency-tag">ETB</span>
            </div>
        </div>
    </div>

    <!-- ═══ 3. PURCHASED ITEMS BREAKDOWN ═══ -->
    <div class="section-header">
        <div class="section-title">Purchased Items</div>
        <div class="section-count">{{ count($order->items) }} {{ count($order->items) === 1 ? 'ITEM' : 'ITEMS' }}</div>
    </div>

    <table class="items-table">
        <colgroup>
            <col style="width: 5%;">
            <col style="width: 51%;">
            <col style="width: 8%;">
            <col style="width: 18%;">
            <col style="width: 18%;">
        </colgroup>
        <thead>
            <tr>
                <th class="col-index">#</th>
                <th>Item Description</th>
                <th class="col-qty">Qty</th>
                <th class="col-price">Unit Price (ETB)</th>
                <th class="col-total">Total (ETB)</th>
            </tr>
        </thead>
        <tbody>
            @foreach($order->items as $idx => $item)
                @php
                    $unit = $item->inventoryUnit;
                    $variant = $unit?->variant ?? $item->variant;
                    $spec = array_filter([$variant?->storage, $variant?->color]);
                    $specStr = !empty($spec) ? implode(' · ', $spec) : '';
                    $lineUnitPrice = count($order->items) === 1
                        ? $settledSaleValue / max(1, (int) $item->quantity)
                        : (float) $item->unit_price;
                    $lineTotal = $item->quantity * $lineUnitPrice;
                @endphp
                <tr>
                    <td class="col-index">{{ $idx + 1 }}</td>
                    <td>
                        @php
                            $isAccessory = !empty($item->is_accessory) || !empty($item->accessory_name);
                            $isVendoredAcc = $isAccessory && ($item->sourcing_type === 'brokered_neighbour' || !empty($item->vendor_contact_id));
                            $itemName = $item->accessory_name ?? ($isVendoredAcc ? 'Vendored Accessory' : ($isAccessory ? 'Accessory' : ($variant?->product?->name ?? $item->variant?->product?->name ?? 'Hardware Device')));
                        @endphp
                        <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                            <span class="item-name">{{ $itemName }}</span>
                            @if($isAccessory)
                                <span style="display: inline-block; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; padding: 1px 5px; border-radius: 4px; background-color: {{ $isVendoredAcc ? '#fef3c7' : '#e0e7ff' }}; color: {{ $isVendoredAcc ? '#92400e' : '#3730a3' }};">
                                    {{ $isVendoredAcc ? 'Vendored Accessory' : 'Accessory' }}
                                </span>
                            @elseif($specStr)
                                <span class="item-spec">({{ $specStr }})</span>
                            @endif
                        </div>
                        @if(!$isAccessory)
                            <div class="item-hardware-tags">
                                @if(!empty($unit?->imei_or_serial))
                                    <span class="sn-badge">SN: {{ $unit->imei_or_serial }}</span>
                                @endif
                                @if(!is_null($unit?->battery_health))
                                    <span>· {{ $unit->battery_health }}% Batt</span>
                                @endif
                                @if(!empty($unit?->sim_type))
                                    <span>· {{ ucfirst(str_replace('_', ' ', $unit->sim_type)) }}</span>
                                @endif
                                @if(!empty($unit?->condition))
                                    <span>· {{ ucfirst(str_replace('_', ' ', $unit->condition)) }}</span>
                                @endif
                            </div>
                        @endif
                    </td>
                    <td class="col-qty">{{ (int) $item->quantity }}</td>
                    <td class="col-price">
                        @if($lineUnitPrice == 0)
                            <span style="color: #b45309; font-weight: 700;">Free Gift</span>
                        @else
                            {{ number_format($lineUnitPrice, 2) }}
                        @endif
                    </td>
                    <td class="col-total">
                        @if($lineTotal == 0)
                            <span style="color: #b45309; font-weight: 700;">0.00</span>
                        @else
                            {{ number_format($lineTotal, 2) }}
                        @endif
                    </td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <!-- ═══ 5. FINANCIAL SETTLEMENT BREAKDOWN ═══ -->
    <div class="financial-summary-grid">
        <div class="financial-card">
            @if($grossAmount != $settledSaleValue)
                <div class="fin-row">
                    <span>Gross Subtotal</span>
                    <span class="fin-num">{{ number_format($grossAmount, 2) }} ETB</span>
                </div>
            @endif

            @if($discountAmount > 0)
                <div class="fin-row" style="color: #be123c;">
                    <span>Discount Applied</span>
                    <span class="fin-num">-{{ number_format($discountAmount, 2) }} ETB</span>
                </div>
            @endif

            @if($writeOffAmount > 0)
                <div class="fin-row" style="color: #be123c;">
                    <span>Price Concession (Write-Off)</span>
                    <span class="fin-num">-{{ number_format($writeOffAmount, 2) }} ETB</span>
                </div>
            @endif

            @if($exchangeAllowance > 0)
                <div class="fin-row" style="color: #7c3aed;">
                    <span>Trade-In ({{ $order->exchangeUnit?->variant?->product?->name ?? 'Device' }}{{ $order->exchangeUnit?->imei_or_serial ? ' · SN: ' . $order->exchangeUnit->imei_or_serial : '' }})</span>
                    <span class="fin-num">-{{ number_format($exchangeAllowance, 2) }} ETB</span>
                </div>
            @endif

            <div class="fin-row total-row">
                <span>{{ $exchangeAllowance > 0 ? 'Cash Difference to Pay' : 'Final Agreed Sale Value' }}</span>
                <span class="fin-num">{{ number_format($settledSaleValue, 2) }} ETB</span>
            </div>

            <div class="fin-row" style="color: #047857; font-weight: 700; margin-top: 3px;">
                <span>Amount Paid</span>
                <span class="fin-num">+{{ number_format($paidAmount, 2) }} ETB</span>
            </div>

            @if(!empty($order->payment_splits) && count($order->payment_splits) > 1)
                @foreach($order->payment_splits as $split)
                    <div class="fin-row" style="font-size: 9.5px; color: #64748b; padding-left: 8px;">
                        <span>↳ {{ $split['account_name'] ?? 'Deposit Account' }}</span>
                        <span class="fin-num">+{{ number_format((float) ($split['amount'] ?? 0), 2) }} ETB</span>
                    </div>
                @endforeach
            @endif

            @if($remainingDebt > 0)
                <div class="fin-row" style="color: #d97706; font-weight: 800; border-top: 1px dashed #e2e8f0; padding-top: 4px; margin-top: 3px;">
                    <span>Balance Due</span>
                    <span class="fin-num">{{ number_format($remainingDebt, 2) }} ETB</span>
                </div>
            @else
                <div class="fin-row" style="color: #047857; font-weight: 600; border-top: 1px dashed #e2e8f0; padding-top: 4px; margin-top: 3px;">
                    <span>Settlement Status</span>
                    <span>Paid in Full</span>
                </div>
            @endif
        </div>
    </div>

    <!-- ═══ 5. ORDER NOTES (if any) ═══ -->
    @if(!empty($sanitizedNotes))
        <div class="notes-card">
            <div class="notes-title">Order Notes & Service Record</div>
            <div style="white-space: pre-line; line-height: 1.45;">{{ $sanitizedNotes }}</div>
        </div>
    @endif

    @php
        $sigPos = $stampConfig['signature_position'] ?? ['x' => 80, 'y' => 92, 'width' => 20];
        $stampPos = $stampConfig['stamp_position'] ?? ['x' => 70, 'y' => 88, 'width' => 24];
        $showSig = ($stampConfig['show_signature'] ?? true) && !empty($signatureBase64);
        $showStamp = ($stampConfig['show_stamp'] ?? true) && !empty($stampBase64);
        $hasCustomPlacement = !empty($stampConfig['has_custom_placement']);
    @endphp

    <!-- ═══ 6. OFFICIAL VERIFICATION SEAL & SIGNATURE ═══ -->
    <div class="official-seal-footer">
        <div class="seal-info">
            <div class="seal-badge">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="m9 12 2 2 4-4"/>
                </svg>
                <span>OFFICIAL FINANCIAL SALES RECORD</span>
            </div>
            <p class="seal-note">
                {{ !empty($business['footer_note']) ? $business['footer_note'] : "7-day testing warranty on internal hardware. Valid receipt and matching serial number required for claims. Physical or liquid damage excluded." }}
            </p>
        </div>

        <div class="signature-box">
            @if($showSig && !$hasCustomPlacement)
                <div class="signature-img-wrap">
                    <img src="{{ $signatureBase64 }}" alt="Authorized Signature" />
                </div>
            @endif

            @if($showStamp && !$hasCustomPlacement)
                <div class="stamp-inplace-wrap">
                    <img src="{{ $stampBase64 }}" alt="Official Stamp" />
                </div>
            @endif

            <div class="signature-line">
                Authorized Signature
            </div>
        </div>
    </div>

    <!-- ═══ 7. FREE-FLOATING MOVABLE & RESIZABLE OVERLAYS (When Custom Placed) ═══ -->
    @if($hasCustomPlacement)
        @if($showStamp)
            <div class="movable-asset" style="
                left: {{ $stampPos['x'] }}%;
                top: {{ $stampPos['y'] }}%;
                width: {{ $stampPos['width'] ?? 24 }}%;
                @if(!empty($stampPos['rotation']))
                    transform: translate(-50%, -50%) rotate({{ $stampPos['rotation'] }}deg);
                @else
                    transform: translate(-50%, -50%);
                @endif
                @if(isset($stampPos['opacity']))
                    opacity: {{ number_format(((float)$stampPos['opacity']) / 100, 2) }};
                @endif
            ">
                <img src="{{ $stampBase64 }}" alt="Official Stamp" />
            </div>
        @endif

        @if($showSig)
            <div class="movable-asset" style="
                left: {{ $sigPos['x'] }}%;
                top: {{ $sigPos['y'] }}%;
                width: {{ $sigPos['width'] ?? 20 }}%;
                @if(!empty($sigPos['rotation']))
                    transform: translate(-50%, -50%) rotate({{ $sigPos['rotation'] }}deg);
                @else
                    transform: translate(-50%, -50%);
                @endif
            ">
                <img src="{{ $signatureBase64 }}" alt="Authorized Signature" />
            </div>
        @endif
    @endif

</body>
</html>
