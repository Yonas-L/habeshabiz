<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{{ $filename ?? 'Vendor Statement' }}</title>
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
            font-size: 9pt;
            line-height: 1.4;
            color: #0f172a;
            background-color: #ffffff;
            padding: 0;
        }

        /* ─── Corporate Letterhead ─── */
        .letterhead {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding-bottom: 10px;
            border-bottom: 2px solid #0f172a;
            margin-bottom: 12px;
        }

        .brand-section {
            display: flex;
            align-items: flex-start;
            gap: 14px;
        }

        .brand-logo {
            max-height: 60px;
            max-width: 170px;
            object-fit: contain;
            border-radius: 8px;
        }

        .brand-logo-fallback {
            width: 50px;
            height: 50px;
            background-color: #0f172a;
            color: #ffffff;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 17pt;
            font-weight: 800;
            letter-spacing: -0.5px;
        }

        .brand-info {
            display: flex;
            flex-direction: column;
            gap: 2px;
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
            font-size: 7.5pt;
            color: #64748b;
            display: flex;
            flex-direction: column;
            gap: 2px;
            margin-top: 3px;
            font-weight: 400;
            line-height: 1.35;
        }

        .doc-title-section {
            text-align: right;
            display: flex;
            flex-direction: column;
            gap: 3px;
        }

        .doc-badge {
            display: inline-block;
            font-size: 11pt;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: #0f172a;
        }

        .doc-range {
            font-size: 8.5pt;
            font-weight: 600;
            color: #475569;
            font-feature-settings: "tnum";
            font-variant-numeric: tabular-nums;
        }

        .doc-issued {
            font-size: 7.5pt;
            color: #94a3b8;
            font-feature-settings: "tnum";
            font-variant-numeric: tabular-nums;
        }

        /* ─── Financial Position Strip ─── */
        .position-strip {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 14px;
            break-inside: avoid;
            page-break-inside: avoid;
        }

        .partner-info {
            display: flex;
            flex-direction: column;
            gap: 3px;
        }

        .partner-label {
            font-size: 7pt;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #94a3b8;
        }

        .partner-name {
            font-size: 13pt;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.2px;
        }

        .partner-meta {
            font-size: 8pt;
            color: #475569;
            display: flex;
            align-items: center;
            gap: 6px;
            font-feature-settings: "tnum";
            font-variant-numeric: tabular-nums;
        }

        .role-tag {
            font-size: 6.5pt;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 2px 6px;
            border-radius: 4px;
            background-color: #e2e8f0;
            color: #334155;
        }

        .balance-box {
            text-align: right;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .balance-verdict {
            display: inline-flex;
            align-items: center;
            justify-content: flex-end;
            gap: 5px;
            font-size: 7.5pt;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .status-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            display: inline-block;
        }

        .status-receivable { color: #047857; }
        .status-receivable .status-dot { background-color: #10b981; }

        .status-payable { color: #b91c1c; }
        .status-payable .status-dot { background-color: #ef4444; }

        .status-settled { color: #475569; }
        .status-settled .status-dot { background-color: #94a3b8; }

        .balance-amount {
            font-size: 16pt;
            font-weight: 800;
            letter-spacing: -0.3px;
            font-feature-settings: "tnum";
            font-variant-numeric: tabular-nums;
        }

        .currency-tag {
            font-size: 8pt;
            font-weight: 600;
            color: #94a3b8;
            margin-left: 4px;
        }

        /* ─── Table Section ─── */
        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }

        .section-title {
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #0f172a;
        }

        .section-count {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 11px;
            font-weight: 400;
            color: #64748b;
            text-transform: uppercase;
        }

        table.ledger-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            table-layout: fixed;
            margin-bottom: 24px;
        }

        table.ledger-table thead {
            display: table-header-group;
        }

        table.ledger-table thead tr {
            border-bottom: 2px solid #0f172a;
            background-color: #f8fafc;
        }

        table.ledger-table th {
            padding: 10px 8px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            color: #0f172a;
            text-align: left;
            white-space: nowrap;
        }

        table.ledger-table th.col-payable,
        table.ledger-table th.col-receivable,
        table.ledger-table th.col-balance {
            text-align: right;
        }

        table.ledger-table tbody tr {
            background-color: #ffffff;
            break-inside: avoid;
            page-break-inside: avoid;
        }

        table.ledger-table td {
            padding: 11px 8px;
            border-bottom: 1px solid #f1f5f9;
            vertical-align: middle;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }

        .col-date {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 11px;
            color: #475569;
            white-space: nowrap;
        }

        .col-type {
            white-space: nowrap;
            padding-right: 14px;
        }

        .col-desc {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            padding-left: 4px;
        }

        .type-pill {
            display: inline-block;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 10px;
            font-weight: 700;
            padding: 2.5px 8px;
            border-radius: 6px;
            white-space: nowrap;
            line-height: 1.3;
        }

        .type-amber { background-color: #fef3c7; color: #92400e; border: 1px solid rgba(253, 230, 138, 0.6); }
        .type-emerald { background-color: #ecfdf5; color: #065f46; border: 1px solid rgba(167, 243, 208, 0.6); }
        .type-blue { background-color: #eff6ff; color: #1e40af; border: 1px solid rgba(191, 219, 254, 0.6); }
        .type-sky { background-color: #f0f9ff; color: #0369a1; border: 1px solid rgba(186, 230, 253, 0.6); }
        .type-rose { background-color: #fff1f2; color: #9f1239; border: 1px solid rgba(254, 205, 211, 0.6); }
        .type-purple { background-color: #faf5ff; color: #6b21a8; border: 1px solid rgba(233, 213, 255, 0.6); }
        .type-indigo { background-color: #eef2ff; color: #3730a3; border: 1px solid rgba(199, 210, 254, 0.6); }
        .type-slate { background-color: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; }

        .col-desc {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .desc-text {
            font-size: 11.5px;
            font-weight: 600;
            color: #0f172a;
            line-height: 1.35;
        }

        .desc-sub {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 10px;
            color: #64748b;
            font-weight: 400;
            margin-top: 2px;
        }

        .col-payable,
        .col-receivable,
        .col-balance {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 11.5px;
            font-variant-numeric: tabular-nums;
            text-align: right;
            white-space: nowrap;
        }

        .dash-muted {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #94a3b8;
            font-size: 11px;
            font-weight: 400;
        }

        /* ─── Table Footer Totals ─── */
        table.ledger-table tfoot {
            display: table-footer-group;
        }

        table.ledger-table tfoot tr {
            border-top: 2px solid #0f172a;
            background-color: #f8fafc;
            break-inside: avoid;
            page-break-inside: avoid;
        }

        table.ledger-table tfoot td {
            padding: 11px 10px;
        }

        .total-label {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #0f172a;
        }

        .total-num {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 11.5px;
            font-weight: 700;
            font-variant-numeric: tabular-nums;
            text-align: right;
            white-space: nowrap;
        }

        /* ─── Minimal Remittance List (No nested borders) ─── */
        .remittance-section {
            margin-top: 16px;
            padding-top: 12px;
            border-top: 1px solid #e2e8f0;
            break-inside: avoid;
            page-break-inside: avoid;
        }

        .remittance-title {
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #475569;
            margin-bottom: 8px;
        }

        .remittance-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px 24px;
        }

        .remittance-item {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            padding-bottom: 3px;
            border-bottom: 1px dashed #e2e8f0;
            font-size: 11px;
        }

        .bank-name {
            font-weight: 600;
            color: #0f172a;
        }

        .bank-type {
            font-size: 9px;
            color: #94a3b8;
            margin-left: 4px;
            text-transform: capitalize;
        }

        .bank-number {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-weight: 700;
            color: #1e293b;
            letter-spacing: 0.3px;
        }

        /* ─── Official Verification Seal & Minimal Signature Line ─── */
        .official-seal-footer {
            margin-top: 32px;
            padding-top: 20px;
            border-top: 2px solid #0f172a;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            gap: 24px;
            break-inside: avoid;
            page-break-inside: avoid;
        }

        .seal-info {
            display: flex;
            flex-direction: column;
            gap: 4px;
            max-width: 400px;
        }

        .seal-badge {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.02em;
            color: #0f172a;
        }

        .seal-note {
            font-size: 10px;
            color: #64748b;
            line-height: 1.4;
            margin-top: 2px;
        }

        .signature-box {
            text-align: right;
            width: 220px;
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
            @if(!empty($business['logo_base64']))
                <img src="{{ $business['logo_base64'] }}" alt="{{ $business['name'] }}" class="brand-logo">
            @else
                <div class="brand-logo-fallback">
                    {{ strtoupper(substr($business['name'] ?? 'H', 0, 2)) }}
                </div>
            @endif
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
        </div>

        <div class="doc-title-section">
            <div class="doc-badge">Vendor Statement</div>
            <div class="doc-range">{{ $range['formatted_range'] ?? 'All Historical Records' }}</div>
            <div class="doc-issued">Issued: {{ now()->format('d/m/Y') }}</div>
        </div>
    </div>

    <!-- ═══ 2. FINANCIAL POSITION STRIP ═══ -->
    @php
        $netBalance = $kpis['range_closing_balance'] ?? 0;
        $isReceivable = $netBalance > 0;
        $isPayable = $netBalance < 0;
        $absBalance = abs($netBalance);
    @endphp
    <div class="position-strip">
        <div class="partner-info">
            <span class="partner-label">Partner Account</span>
            <div class="partner-name">{{ $contact['name'] }}</div>
            <div class="partner-meta">
                @if(!empty($contact['phone']))
                    <span>{{ $contact['phone'] }}</span>
                @endif
                @if(!empty($contact['alt_phone']))
                    <span>· {{ $contact['alt_phone'] }}</span>
                @endif
                @if(!empty($contact['roles']))
                    @foreach((array)$contact['roles'] as $role)
                        <span class="role-tag">{{ str_replace('_', ' ', $role) }}</span>
                    @endforeach
                @endif
            </div>
        </div>

        <div class="balance-box">
            <div class="balance-verdict {{ $isReceivable ? 'status-receivable' : ($isPayable ? 'status-payable' : 'status-settled') }}">
                <span class="status-dot"></span>
                <span>{{ $isReceivable ? 'Partner Owes Us' : ($isPayable ? 'We Owe Partner' : 'Settled In Full') }}</span>
            </div>
            <div class="balance-amount {{ $isReceivable ? 'status-receivable' : ($isPayable ? 'status-payable' : 'status-settled') }}">
                {{ $isReceivable ? '+' : ($isPayable ? '−' : '') }}{{ number_format($absBalance, 2) }}<span class="currency-tag">ETB</span>
            </div>
        </div>
    </div>

    <!-- ═══ 3. TRANSACTION ACTIVITY BREAKDOWN ═══ -->
    <div class="section-header">
        <div class="section-title">Transaction Activity Breakdown</div>
        <div class="section-count">{{ count($ledger) }} {{ count($ledger) === 1 ? 'ENTRY' : 'ENTRIES' }}</div>
    </div>

    <table class="ledger-table">
        <colgroup>
            <col style="width: 11%;">
            <col style="width: 18%;">
            <col style="width: 29%;">
            <col style="width: 14%;">
            <col style="width: 14%;">
            <col style="width: 14%;">
        </colgroup>
        <thead>
            <tr>
                <th class="col-date">Date</th>
                <th class="col-type">Type</th>
                <th class="col-desc">Description</th>
                <th class="col-payable">Payable (ETB)</th>
                <th class="col-receivable">Receivable (ETB)</th>
                <th class="col-balance">Balance (ETB)</th>
            </tr>
        </thead>
        <tbody>
            @forelse($ledger as $row)
                @php
                    $rowType = $row['type'] ?? '';
                    $pillClass = match(true) {
                        $rowType === 'consignment_sale' || $rowType === 'brokered_sourcing' || $rowType === 'manual_payable' => 'type-amber',
                        $rowType === 'device_offset' || $rowType === 'bilateral_offset' || $rowType === 'payment_received' => 'type-emerald',
                        $rowType === 'payment_sent' => 'type-blue',
                        $rowType === 'repair_offset' => 'type-sky',
                        $rowType === 'repair_claim' || str_contains($rowType, 'return') || str_contains($rowType, 'refund') => 'type-rose',
                        $rowType === 'sales_credit' || $rowType === 'handover_holding' || $rowType === 'manual_receivable' || $rowType === 'customer_purchase' => 'type-purple',
                        $rowType === 'payout_advance' => 'type-indigo',
                        default => 'type-slate',
                    };
                    $dateFormatted = !empty($row['date']) ? \Carbon\Carbon::parse($row['date'])->format('d/m/Y') : '—';
                @endphp
                <tr>
                    <td class="col-date">{{ $dateFormatted }}</td>
                    <td class="col-type">
                        <span class="type-pill {{ $pillClass }}">{{ $row['type_label'] ?? ucfirst(str_replace('_', ' ', $rowType)) }}</span>
                    </td>
                    <td class="col-desc">
                        <div class="desc-text">{{ $row['context'] ?? 'Transaction entry' }}</div>
                        @if(!empty($row['reference_number']) && !str_starts_with($row['reference_number'], 'ORD-'))
                            <div class="desc-sub">Ref: {{ $row['reference_number'] }}</div>
                        @elseif(!empty($row['account_name']))
                            <div class="desc-sub">via {{ $row['account_name'] }}</div>
                        @endif
                    </td>
                    <td class="col-payable">
                        @if(!empty($row['payable']) && $row['payable'] != 0)
                            <span style="{{ $row['payable'] < 0 ? 'color: #1d4ed8; font-weight: 700;' : 'color: #0f172a; font-weight: 500;' }}">
                                {{ $row['payable'] < 0 ? '−' : '' }}{{ number_format(abs($row['payable']), 2) }}
                            </span>
                        @else
                            <span class="dash-muted">—</span>
                        @endif
                    </td>
                    <td class="col-receivable">
                        @if(!empty($row['receivable']) && $row['receivable'] != 0)
                            <span style="{{ $row['receivable'] < 0 ? 'color: #047857; font-weight: 700;' : 'color: #0f172a; font-weight: 500;' }}">
                                {{ $row['receivable'] < 0 ? '−' : '' }}{{ number_format(abs($row['receivable']), 2) }}
                            </span>
                        @else
                            <span class="dash-muted">—</span>
                        @endif
                    </td>
                    <td class="col-balance">
                        <span style="{{ ($row['running_balance'] ?? 0) > 0 ? 'color: #047857; font-weight: 800;' : ((($row['running_balance'] ?? 0) < 0) ? 'color: #be123c; font-weight: 800;' : 'color: #475569; font-weight: 700;') }}">
                            {{ ($row['running_balance'] ?? 0) > 0 ? '+' : '' }}{{ number_format($row['running_balance'] ?? 0, 2) }}
                        </span>
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="6" style="text-align: center; padding: 28px; color: #94a3b8; font-style: italic; font-size: 12px;">
                        No transactions recorded for this partner within the selected period.
                    </td>
                </tr>
            @endforelse
        </tbody>
        <tfoot>
            @php
                $totalPayable = array_sum(array_column($ledger, 'payable'));
                $totalReceivable = array_sum(array_column($ledger, 'receivable'));
            @endphp
            <tr>
                <td colspan="3" class="total-label">
                    Statement Period Totals
                </td>
                <td class="total-num" style="color: #0f172a;">
                    {{ number_format(abs($totalPayable), 2) }}
                </td>
                <td class="total-num" style="color: #0f172a;">
                    {{ number_format(abs($totalReceivable), 2) }}
                </td>
                <td class="total-num" style="color: {{ $netBalance > 0 ? '#047857' : ($netBalance < 0 ? '#be123c' : '#0f172a') }}; font-weight: 800;">
                    {{ $netBalance > 0 ? '+' : '' }}{{ number_format($netBalance, 2) }}
                </td>
            </tr>
        </tfoot>
    </table>

    <!-- ═══ 4. REMITTANCE / BANK ACCOUNTS (Only when vendor owes us / receivable) ═══ -->
    @if($isReceivable && !empty($selectedAccounts) && count($selectedAccounts) > 0)
        <div class="remittance-section">
            <div class="remittance-title">Remittance Accounts</div>
            <div class="remittance-grid">
                @foreach($selectedAccounts as $acc)
                    <div class="remittance-item">
                        <div>
                            <span class="bank-name">{{ $acc['name'] }}</span>
                            <span class="bank-type">({{ ucfirst(str_replace('_', ' ', $acc['type'] ?? 'bank')) }})</span>
                        </div>
                        <span class="bank-number">{{ $acc['account_number'] ?? 'Cashier Desk' }}</span>
                    </div>
                @endforeach
            </div>
        </div>
    @endif

    <!-- ═══ 5. OFFICIAL VERIFICATION SEAL & MINIMAL SIGNATURE ═══ -->
    <div class="official-seal-footer">
        <div class="seal-info">
            <div class="seal-badge">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="m9 12 2 2 4-4"/>
                </svg>
                <span>OFFICIAL FINANCIAL STATEMENT</span>
            </div>
            <p class="seal-note">
                {{ !empty($business['footer_note']) ? $business['footer_note'] : "Thank you for your business. Defect coverage valid for 7 days with intact warranty and receipt." }}
            </p>
        </div>

        <div class="signature-box">
            <div class="signature-line">
                Authorized Signature
            </div>
        </div>
    </div>

</body>
</html>
