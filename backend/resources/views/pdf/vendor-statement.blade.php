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
            font-size: 10pt;
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
            border-bottom: 2.5px solid #0f172a;
            margin-bottom: 12px;
        }

        .brand-section {
            display: flex;
            align-items: flex-start;
            gap: 14px;
        }

        .brand-logo {
            max-height: 64px;
            max-width: 180px;
            object-fit: contain;
            border-radius: 8px;
        }

        .brand-logo-fallback {
            width: 54px;
            height: 54px;
            background-color: #0f172a;
            color: #ffffff;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 19pt;
            font-weight: 900;
            letter-spacing: -0.5px;
        }

        .brand-info {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .company-name {
            font-size: 15pt;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: -0.3px;
            color: #0f172a;
            line-height: 1.2;
        }

        .company-meta {
            font-size: 8pt;
            color: #64748b;
            display: flex;
            flex-direction: column;
            gap: 2px;
            margin-top: 3px;
            font-weight: 500;
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
            font-size: 12pt;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #0f172a;
        }

        .doc-range {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 9pt;
            font-weight: 700;
            color: #475569;
        }

        .doc-issued {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 8pt;
            color: #94a3b8;
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
            font-size: 7.5pt;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #94a3b8;
        }

        .partner-name {
            font-size: 14pt;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: -0.2px;
        }

        .partner-meta {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 8.5pt;
            color: #475569;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .role-tag {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 7pt;
            font-weight: 800;
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
            font-size: 8pt;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.6px;
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
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 18pt;
            font-weight: 900;
            letter-spacing: -0.5px;
        }

        .currency-tag {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 9pt;
            font-weight: 700;
            color: #94a3b8;
            margin-left: 4px;
        }

        /* ─── Table Section ─── */
        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 8px;
        }

        .section-title {
            font-size: 8.5pt;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #0f172a;
        }

        .section-count {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 8pt;
            color: #94a3b8;
        }

        table.ledger-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8.5pt;
            table-layout: fixed;
            margin-bottom: 22px;
        }

        table.ledger-table thead {
            display: table-header-group;
        }

        table.ledger-table tfoot {
            display: table-footer-group;
        }

        table.ledger-table tr {
            break-inside: avoid;
            page-break-inside: avoid;
        }

        table.ledger-table th {
            border-bottom: 2px solid #0f172a;
            padding: 6px 6px;
            font-size: 7.5pt;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            color: #0f172a;
            text-align: left;
            background-color: #ffffff;
            white-space: nowrap;
        }

        table.ledger-table th.col-payable,
        table.ledger-table th.col-receivable,
        table.ledger-table th.col-balance {
            text-align: right;
        }

        table.ledger-table td {
            padding: 5.5px 6px;
            border-bottom: 1px solid #f1f5f9;
            vertical-align: top;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }

        table.ledger-table tbody tr:nth-child(even) {
            background-color: #fafbfc;
        }

        .col-date { width: 11%; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #475569; font-size: 8pt; white-space: nowrap; }
        .col-type { width: 15%; padding-right: 8px; }
        .col-desc { width: 32%; padding-left: 4px; }
        .col-payable { width: 14%; text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: nowrap; }
        .col-receivable { width: 14%; text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: nowrap; }
        .col-balance { width: 14%; text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 700; white-space: nowrap; }

        .type-pill {
            display: inline-block;
            font-size: 7pt;
            font-weight: 700;
            padding: 2px 7px;
            border-radius: 4px;
            white-space: nowrap;
        }

        .type-consignment { background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
        .type-payment { background-color: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
        .type-return { background-color: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
        .type-default { background-color: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; }

        .desc-text {
            color: #0f172a;
            font-weight: 600;
            line-height: 1.35;
        }

        .desc-sub {
            color: #64748b;
            font-size: 7.5pt;
            margin-top: 1px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        /* ─── Table Footer Totals ─── */
        table.ledger-table tfoot tr {
            border-top: 2px solid #0f172a;
            border-bottom: 2px solid #0f172a;
            background-color: #f8fafc;
            font-weight: 800;
        }

        table.ledger-table tfoot td {
            padding: 8px 10px;
            font-size: 8.5pt;
        }

        /* ─── Minimal Remittance List (No nested borders) ─── */
        .remittance-section {
            margin-top: 12px;
            padding-top: 10px;
            border-top: 1px solid #e2e8f0;
            break-inside: avoid;
            page-break-inside: avoid;
        }

        .remittance-title {
            font-size: 7.5pt;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #475569;
            margin-bottom: 6px;
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
            font-size: 8pt;
        }

        .bank-name {
            font-weight: 700;
            color: #0f172a;
        }

        .bank-type {
            font-size: 7pt;
            color: #94a3b8;
            margin-left: 4px;
            text-transform: capitalize;
        }

        .bank-number {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-weight: 800;
            color: #1e293b;
            letter-spacing: 0.3px;
        }

        /* ─── Official Verification Seal & Minimal Signature Line ─── */
        .official-seal-footer {
            margin-top: 14px;
            padding-top: 10px;
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
            max-width: 380px;
        }

        .seal-badge {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            font-size: 7.5pt;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: #0f172a;
        }

        .seal-note {
            font-size: 7pt;
            color: #64748b;
            line-height: 1.35;
        }

        .signature-box {
            text-align: right;
            min-width: 200px;
        }

        .signature-line {
            border-top: 1.5px solid #0f172a;
            padding-top: 4px;
            text-align: center;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 7.5pt;
            font-weight: 700;
            color: #334155;
            text-transform: uppercase;
            letter-spacing: 0.5px;
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
        <div class="section-count">{{ count($ledger) }} {{ count($ledger) === 1 ? 'entry' : 'entries' }}</div>
    </div>

    <table class="ledger-table">
        <thead>
            <tr>
                <th class="col-date">Date</th>
                <th class="col-type">Type</th>
                <th class="col-desc">Description</th>
                <th class="col-payable">Payable(ETB)</th>
                <th class="col-receivable">Receivable(ETB)</th>
                <th class="col-balance">Balance(ETB)</th>
            </tr>
        </thead>
        <tbody>
            @forelse($ledger as $row)
                @php
                    $rowType = $row['type'] ?? '';
                    $pillClass = match(true) {
                        str_contains($rowType, 'payment') || str_contains($rowType, 'settlement') => 'type-payment',
                        str_contains($rowType, 'consignment') || str_contains($rowType, 'sourcing') => 'type-consignment',
                        str_contains($rowType, 'return') || str_contains($rowType, 'refund') => 'type-return',
                        default => 'type-default',
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
                        @if(!empty($row['reference_number']) || !empty($row['account_name']))
                            <div class="desc-sub">
                                @if(!empty($row['account_name']))
                                    <span>via {{ $row['account_name'] }}</span>
                                @endif
                                @if(!empty($row['reference_number']))
                                    <span>· Ref: {{ $row['reference_number'] }}</span>
                                @endif
                            </div>
                        @endif
                    </td>
                    <td class="col-payable">
                        @if(!empty($row['payable']) && $row['payable'] != 0)
                            <span style="{{ $row['payable'] < 0 ? 'color: #2563eb; font-weight: 700;' : '' }}">
                                {{ $row['payable'] < 0 ? '−' : '' }}{{ number_format(abs($row['payable']), 2) }}
                            </span>
                        @else
                            <span style="color: #cbd5e1;">—</span>
                        @endif
                    </td>
                    <td class="col-receivable">
                        @if(!empty($row['receivable']) && $row['receivable'] != 0)
                            <span style="{{ $row['receivable'] < 0 ? 'color: #047857; font-weight: 700;' : '' }}">
                                {{ $row['receivable'] < 0 ? '−' : '' }}{{ number_format(abs($row['receivable']), 2) }}
                            </span>
                        @else
                            <span style="color: #cbd5e1;">—</span>
                        @endif
                    </td>
                    <td class="col-balance" style="color: {{ ($row['running_balance'] ?? 0) > 0 ? '#047857' : (($row['running_balance'] ?? 0) < 0 ? '#b91c1c' : '#0f172a') }};">
                        {{ ($row['running_balance'] ?? 0) > 0 ? '+' : '' }}{{ number_format($row['running_balance'] ?? 0, 2) }}
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="6" style="text-align: center; padding: 24px; color: #94a3b8; font-style: italic;">
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
                <td colspan="3" style="text-transform: uppercase; letter-spacing: 0.5px; font-size: 8pt; font-weight: 900;">
                    Statement Period Totals
                </td>
                <td class="col-payable" style="font-weight: 900; color: {{ $totalPayable < 0 ? '#2563eb' : '#b91c1c' }};">
                    {{ $totalPayable < 0 ? '−' : '' }}{{ number_format(abs($totalPayable), 2) }}
                </td>
                <td class="col-receivable" style="font-weight: 900; color: #047857;">
                    {{ $totalReceivable < 0 ? '−' : '' }}{{ number_format(abs($totalReceivable), 2) }}
                </td>
                <td class="col-balance" style="font-weight: 900; color: {{ $netBalance > 0 ? '#047857' : ($netBalance < 0 ? '#b91c1c' : '#0f172a') }};">
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
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="m9 12 2 2 4-4"/>
                </svg>
                <span>OFFICIAL FINANCIAL STATEMENT</span>
            </div>
            <p class="seal-note">
                {{ !empty($business['footer_note']) ? $business['footer_note'] : "Official accounting statement generated by {$business['name']}. All ledger entries are verified and preserved." }}
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
