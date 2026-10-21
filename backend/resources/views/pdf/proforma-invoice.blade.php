<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{{ $filename ?? 'Proforma Invoice' }}</title>
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
            font-size: 9.5pt;
            line-height: 1.4;
            color: #0f172a;
            background-color: #ffffff;
            padding: 0;
            position: relative;
            min-height: 270mm;
            box-sizing: border-box;
        }

        .doc-wrapper {
            min-height: 270mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }

        .doc-top-flow {
            flex: 1;
        }

        .doc-bottom-flow {
            margin-top: 16px;
        }

        /* ─── Corporate Letterhead ─── */
        .letterhead {
            display: table;
            width: 100%;
            table-layout: fixed;
            padding-bottom: 12px;
            border-bottom: 2px solid #0f172a;
            margin-bottom: 14px;
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
            font-size: 16pt;
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
            font-size: 8pt;
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
            font-size: 12pt;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: #0f172a;
        }

        .doc-number {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 10pt;
            font-weight: 700;
            color: #475569;
            margin-top: 2px;
        }

        .doc-date {
            font-size: 8pt;
            color: #64748b;
            font-feature-settings: "tnum";
            font-variant-numeric: tabular-nums;
            margin-top: 2px;
        }

        .status-pill {
            display: inline-block;
            margin-top: 3px;
            font-size: 7pt;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            padding: 2.5px 8px;
            border-radius: 9999px;
            background-color: #ecfdf5;
            color: #047857;
            border: 1px solid #a7f3d0;
        }

        /* ─── Executive Recipient Strip (ISSUED TO) ─── */
        .recipient-strip {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 14px;
            break-inside: avoid;
            page-break-inside: avoid;
        }

        .recipient-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
        }

        .recipient-label {
            font-size: 7pt;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #94a3b8;
        }

        .recipient-name {
            font-size: 11pt;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.2px;
            line-height: 1.25;
            margin-bottom: 3px;
        }

        .recipient-grid {
            display: flex;
            flex-direction: column;
            gap: 2.5px;
            font-size: 8pt;
            color: #475569;
            line-height: 1.35;
            margin-top: 3px;
        }

        .meta-item {
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }

        .meta-lbl {
            font-weight: 700;
            color: #64748b;
        }

        .party-ref-badge {
            display: inline-block;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 7.5pt;
            font-weight: 700;
            color: #0f172a;
            background-color: #ffffff;
            border: 1px solid #cbd5e1;
            padding: 1.5px 6px;
            border-radius: 4px;
        }

        /* ─── Line Items Table (Executive & Clean) ─── */
        .section-header {
            display: table;
            width: 100%;
            margin-bottom: 8px;
        }

        .section-title {
            display: table-cell;
            vertical-align: middle;
            font-size: 8pt;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #0f172a;
        }

        .section-count {
            display: table-cell;
            vertical-align: middle;
            text-align: right;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 8pt;
            font-weight: 600;
            color: #64748b;
        }

        table.items-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9.5pt;
            table-layout: fixed;
            margin-bottom: 14px;
        }

        table.items-table thead {
            display: table-header-group;
        }

        table.items-table thead tr {
            border-top: 1px solid #0f172a;
            border-bottom: 2px solid #0f172a;
            background-color: #f8fafc;
        }

        table.items-table th {
            padding: 8px 8px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 7.5pt;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: #0f172a;
            text-align: left;
            white-space: nowrap;
        }

        table.items-table th.col-sno,
        table.items-table th.col-unit,
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

        table.items-table tbody tr:nth-child(even) {
            background-color: #fbfcfe;
        }

        table.items-table td {
            padding: 9px 8px;
            border-bottom: 1px solid #f1f5f9;
            vertical-align: top;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }

        table.items-table tr.blank-row td {
            height: 22px;
            border-bottom: 1px dashed #e2e8f0;
            background-color: transparent;
        }

        .col-sno {
            width: 36px;
            text-align: center;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            color: #94a3b8;
            font-size: 8.5pt;
        }

        .item-name {
            font-weight: 700;
            color: #0f172a;
            font-size: 9.5pt;
        }

        .item-sku {
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 7.5pt;
            color: #64748b;
            margin-top: 2px;
        }

        .col-unit {
            width: 52px;
            text-align: center;
            font-size: 8.5pt;
            color: #475569;
        }

        .col-qty {
            width: 48px;
            text-align: center;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-weight: 700;
            color: #0f172a;
            font-size: 9.5pt;
        }

        .col-price {
            width: 105px;
            text-align: right;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-variant-numeric: tabular-nums;
            color: #475569;
            font-size: 9.5pt;
            white-space: nowrap;
        }

        .col-total {
            width: 120px;
            text-align: right;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-variant-numeric: tabular-nums;
            font-weight: 800;
            color: #0f172a;
            font-size: 9.5pt;
            white-space: nowrap;
        }

        /* ─── Financial Settlement Card ─── */
        .financial-summary-grid {
            width: 100%;
            margin-bottom: 14px;
            break-inside: avoid;
            page-break-inside: avoid;
        }

        .financial-card {
            width: 330px;
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
            font-size: 8.5pt;
            padding: 2.5px 0;
            color: #475569;
        }

        .fin-label {
            display: table-cell;
            text-align: left;
            vertical-align: middle;
            font-weight: 600;
        }

        .fin-num {
            display: table-cell;
            text-align: right;
            vertical-align: middle;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-variant-numeric: tabular-nums;
            font-weight: 600;
            color: #0f172a;
        }

        .fin-row.total-row {
            border-top: 2px solid #0f172a;
            padding-top: 6px;
            margin-top: 4px;
            font-size: 11pt;
            font-weight: 900;
            color: #0f172a;
        }

        .fin-row.total-row .fin-num {
            font-size: 11.5pt;
            font-weight: 900;
            color: #0f172a;
        }

        /* ─── Notes & Banking Details ─── */
        .bottom-info-strip {
            display: flex;
            gap: 12px;
            margin-bottom: 16px;
            break-inside: avoid;
            page-break-inside: avoid;
        }

        .info-card {
            flex: 1;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 9px 12px;
            font-size: 8pt;
        }

        .info-card-title {
            font-size: 7pt;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: #64748b;
            margin-bottom: 4px;
        }

        .info-card-body {
            color: #334155;
            line-height: 1.4;
        }

        .mono-bold {
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-weight: 700;
            color: #0f172a;
        }

        /* ─── Official Verification & Signatures ─── */
        .official-seal-footer {
            margin-top: 14px;
            padding-top: 12px;
            border-top: 2px solid #0f172a;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            gap: 24px;
            break-inside: avoid;
            page-break-inside: avoid;
        }

        .seal-prep {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .signature-box {
            text-align: right;
            width: 220px;
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
            bottom: -6px;
            width: 82px;
            height: 82px;
            pointer-events: none;
            opacity: 0.92;
        }

        .stamp-inplace-wrap img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        .signature-line {
            border-bottom: 2px solid #0f172a;
            padding-bottom: 4px;
            text-align: center;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 8pt;
            font-weight: 700;
            color: #334155;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }

        .sig-title {
            font-size: 7pt;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #94a3b8;
        }

        .sig-name {
            font-size: 10pt;
            font-weight: 800;
            color: #0f172a;
        }

        .sig-sub {
            font-size: 7pt;
            color: #64748b;
        }

        /* ─── Free-floating Stamp & Signature Overlay ─── */
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
    </style>
</head>
<body>

    @php
        $sigPos = $stampConfig['signature_position'] ?? ['x' => 78, 'y' => 89, 'width' => 20];
        $stampPos = $stampConfig['stamp_position'] ?? ['x' => 74, 'y' => 84, 'width' => 22];
        $showSig = ($stampConfig['show_signature'] ?? true) && !empty($signatureBase64);
        $showStamp = ($stampConfig['show_stamp'] ?? true) && !empty($stampBase64);
        $hasCustomPlacement = !empty($stampConfig['has_custom_placement']);

        $itemCount = count($proforma->items ?? []);
        $minRows = max(0, 3 - $itemCount);
    @endphp

    <div class="doc-wrapper">
        <div class="doc-top-flow">
            <!-- ═══ 1. CORPORATE LETTERHEAD ═══ -->
            <div class="letterhead">
                <div class="brand-section">
                    <table class="brand-layout-table">
                        <tr>
                            <td style="padding-right: 14px;">
                                @if(!empty($business['logo_base64']))
                                    <img class="brand-logo" src="{{ $business['logo_base64'] }}" alt="{{ $business['name'] }}">
                                @else
                                    <div class="brand-logo-fallback">
                                        {{ strtoupper(substr($business['name'] ?? 'HB', 0, 2)) }}
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
                                            <div>Tel: {{ $business['phone'] }}</div>
                                        @endif
                                        @if(!empty($business['tin_number']))
                                            <div>TIN: {{ $business['tin_number'] }}</div>
                                        @endif
                                        @if(!empty($business['vat_number']) && $business['vat_number'] !== ($business['tin_number'] ?? null))
                                            <div>VAT: {{ $business['vat_number'] }}</div>
                                        @endif
                                        @if(!empty($business['email']))
                                            <div>Email: {{ $business['email'] }}</div>
                                        @endif
                                    </div>
                                </div>
                            </td>
                        </tr>
                    </table>
                </div>

                <div class="doc-title-section">
                    <div class="doc-badge">PROFORMA INVOICE</div>
                    <div class="doc-number">#{{ $proforma->proforma_number }}</div>
                    <div class="doc-date">Date: {{ \Carbon\Carbon::parse($proforma->issue_date)->format('d M, Y') }}</div>
                    @if(!empty($proforma->valid_until))
                        <div class="doc-date" style="color: #475569;">Valid Until: {{ \Carbon\Carbon::parse($proforma->valid_until)->format('d M, Y') }}</div>
                    @endif
                    <div class="status-pill">OFFICIAL QUOTATION</div>
                </div>
            </div>

            <!-- ═══ 2. RECIPIENT DETAILS (ISSUED TO) ═══ -->
            <div class="recipient-strip">
                <div class="recipient-header">
                    <span class="recipient-label">QUOTATION ISSUED TO (CLIENT / BUYER)</span>
                    @if(!empty($proforma->reference_number))
                        <span class="party-ref-badge">Ref / RFQ: #{{ $proforma->reference_number }}</span>
                    @endif
                </div>
                <div class="recipient-card">
                    <div class="recipient-name">{{ $proforma->customer_name }}</div>
                    <div class="recipient-grid">
                        @if(!empty($proforma->customer_phone))
                            <div class="meta-item"><span class="meta-lbl">Tel:</span> {{ $proforma->customer_phone }}</div>
                        @endif
                        @if(!empty($proforma->customer_email))
                            <div class="meta-item"><span class="meta-lbl">Email:</span> {{ $proforma->customer_email }}</div>
                        @endif
                        @if(!empty($proforma->customer_tin))
                            <div class="meta-item"><span class="meta-lbl">TIN / VAT:</span> {{ $proforma->customer_tin }}</div>
                        @endif
                        @if(!empty($proforma->customer_address))
                            <div class="meta-item"><span class="meta-lbl">Address:</span> {{ $proforma->customer_address }}</div>
                        @endif
                        @if(empty($proforma->customer_phone) && empty($proforma->customer_tin) && empty($proforma->customer_address))
                            <div class="meta-item" style="color: #94a3b8; font-style: italic;">Official Customer Entity</div>
                        @endif
                    </div>
                </div>
            </div>

            <!-- ═══ 3. LINE ITEMS TABLE (Executive & Well-Formatted) ═══ -->
            <div class="section-header">
                <span class="section-title">QUOTATION LINE ITEMS</span>
                <span class="section-count">{{ count($proforma->items ?? []) }} ITEM(S)</span>
            </div>

            <table class="items-table">
                <thead>
                    <tr>
                        <th class="col-sno">#</th>
                        <th>Item & Description</th>
                        <th class="col-unit">Unit</th>
                        <th class="col-qty">Qty</th>
                        <th class="col-price">Unit Price</th>
                        <th class="col-total">Line Total</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($proforma->items as $idx => $item)
                        <tr>
                            <td class="col-sno">{{ $item->item_number ?: ($idx + 1) }}</td>
                            <td>
                                <div class="item-name">{{ $item->description }}</div>
                                @if(!empty($item->sku))
                                    <div class="item-sku">SKU: {{ $item->sku }}</div>
                                @endif
                            </td>
                            <td class="col-unit">{{ $item->unit_of_measure ?: 'Pcs' }}</td>
                            <td class="col-qty">{{ (float) $item->quantity == (int) $item->quantity ? (int) $item->quantity : number_format($item->quantity, 2) }}</td>
                            <td class="col-price">{{ number_format($item->unit_price, 2) }}</td>
                            <td class="col-total">{{ number_format($item->line_total, 2) }}</td>
                        </tr>
                    @endforeach

                    <!-- Subtle ruling continuation lines if few items -->
                    @for($i = 0; $i < $minRows; $i++)
                        <tr class="blank-row">
                            <td class="col-sno"></td>
                            <td></td>
                            <td class="col-unit"></td>
                            <td class="col-qty"></td>
                            <td class="col-price"></td>
                            <td class="col-total"></td>
                        </tr>
                    @endfor
                </tbody>
            </table>

            <!-- ═══ 4. FINANCIAL SETTLEMENT SUMMARY ═══ -->
            <div class="financial-summary-grid">
                <div class="financial-card">
                    <div class="fin-row">
                        <span class="fin-label">Subtotal</span>
                        <span class="fin-num">{{ number_format($proforma->subtotal, 2) }} {{ $proforma->currency }}</span>
                    </div>

                    @if($proforma->vat_total > 0 || $proforma->vat_rate > 0)
                        <div class="fin-row">
                            <span class="fin-label">VAT ({{ (float) $proforma->vat_rate == (int) $proforma->vat_rate ? (int) $proforma->vat_rate : number_format($proforma->vat_rate, 1) }}%)</span>
                            <span class="fin-num">+{{ number_format($proforma->vat_total, 2) }}</span>
                        </div>
                    @endif

                    @if($proforma->withholding_total > 0)
                        <div class="fin-row" style="color: #b91c1c;">
                            <span class="fin-label">Less: WHT Deduction ({{ (float) $proforma->withholding_rate == (int) $proforma->withholding_rate ? (int) $proforma->withholding_rate : number_format($proforma->withholding_rate, 1) }}%)</span>
                            <span class="fin-num">-{{ number_format($proforma->withholding_total, 2) }}</span>
                        </div>
                    @endif

                    @if($proforma->shipping_fee > 0)
                        <div class="fin-row">
                            <span class="fin-label">Logistics / Delivery</span>
                            <span class="fin-num">+{{ number_format($proforma->shipping_fee, 2) }}</span>
                        </div>
                    @endif

                    <div class="fin-row total-row">
                        <span class="fin-label">GRAND TOTAL</span>
                        <span class="fin-num">{{ number_format($proforma->net_payable ?: $proforma->total_amount, 2) }} {{ $proforma->currency }}</span>
                    </div>
                </div>
            </div>

            <!-- ═══ 5. TERMS & CONDITIONS (OPTIONAL) ═══ -->
            @if(!empty($proforma->notes))
                <div class="bottom-info-strip">
                    <div class="info-card">
                        <div class="info-card-title">Terms & Quotation Conditions</div>
                        <div class="info-card-body" style="white-space: pre-line;">{{ $proforma->notes }}</div>
                    </div>
                </div>
            @endif
        </div>

        <!-- ═══ 6. OFFICIAL VERIFICATION & SIGNATURES ═══ -->
        <div class="doc-bottom-flow">
            <div class="official-seal-footer">
                <div class="seal-prep">
                    <div class="sig-title">PREPARED BY</div>
                    <div class="sig-name">{{ $proforma->prepared_by ?: ($proforma->creator?->name ?: $business['name']) }}</div>
                </div>

                <div class="signature-box">
                    @if($showSig && !$hasCustomPlacement)
                        <div class="signature-img-wrap">
                            <img src="{{ $signatureBase64 }}" alt="Authorized Signature" />
                        </div>
                    @endif

                    @if($showStamp && !$hasCustomPlacement)
                        <div class="stamp-inplace-wrap" @if(isset($stampPos['opacity'])) style="opacity: {{ number_format(((float)$stampPos['opacity']) / 100, 2) }};" @endif>
                            <img src="{{ $stampBase64 }}" alt="Official Stamp" />
                        </div>
                    @endif

                    <div class="signature-line">
                        AUTHORIZED SIGNATURE & STAMP
                    </div>
                    <div class="sig-sub" style="text-align: center; margin-top: 3px;">Date & Official Company Seal Verification</div>
                </div>
            </div>
        </div>
    </div>

    <!-- ═══ 7. FREE-FLOATING STAMP & SIGNATURE (When Custom Placed) ═══ -->
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
                <img src="{{ $signatureBase64 }}" alt="Signature" />
            </div>
        @endif
    @endif

</body>
</html>
