<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{{ $filename ?? 'Financial Statement' }}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 10mm 12mm 10mm 12mm;
        }

        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        body, div, p, table, tr, td, th, ul, ol, li, h1, h2, h3, h4, h5, h6 {
            margin: 0;
            padding: 0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 10.5px;
            line-height: 1.4;
            color: #0f172a;
            background-color: #ffffff;
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
            max-height: 54px;
            max-width: 160px;
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
            font-size: 9.5px;
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

        .doc-period {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 10.5px;
            font-weight: 700;
            color: #047857;
            background-color: #ecfdf5;
            padding: 2px 8px;
            border-radius: 4px;
            border: 1px solid #a7f3d0;
            display: inline-block;
            margin-top: 2px;
        }

        .doc-meta {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 9.5px;
            color: #94a3b8;
            margin-top: 2px;
        }

        /* ─── Executive KPI Highlights ─── */
        .kpi-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 8px 0;
            table-layout: fixed;
            margin-left: -8px;
            margin-right: -8px;
            margin-bottom: 14px;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .kpi-table td {
            vertical-align: top;
            padding: 0;
            border: none;
        }

        .kpi-card {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 9px 12px;
            min-height: 64px;
        }

        .kpi-card.highlight-profit {
            background-color: #f0fdf4;
            border-color: #bbf7d0;
        }

        .kpi-card.highlight-loss {
            background-color: #fff1f2;
            border-color: #fecdd3;
        }

        .kpi-label {
            font-size: 8.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            margin-bottom: 3px;
        }

        .kpi-val {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 12.5pt;
            font-weight: 800;
            color: #0f172a;
            font-variant-numeric: tabular-nums;
            letter-spacing: -0.3px;
        }

        .kpi-sub {
            font-size: 8.5px;
            color: #64748b;
            margin-top: 3px;
            font-weight: 500;
        }

        /* ─── Section Header ─── */
        .section-header {
            display: table;
            width: 100%;
            margin-top: 14px;
            margin-bottom: 8px;
            padding-bottom: 4px;
            border-bottom: 1.5px solid #0f172a;
            page-break-after: avoid;
            break-after: avoid;
        }

        .section-title {
            display: table-cell;
            vertical-align: middle;
            font-size: 9.5pt;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #0f172a;
        }

        .section-pill {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 8.5px;
            font-weight: 600;
            color: #475569;
            background-color: #f1f5f9;
            padding: 1px 6px;
            border-radius: 4px;
            float: right;
        }

        /* ─── Modern Tables ─── */
        table.report-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            margin-bottom: 12px;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        table.report-table thead tr {
            background-color: #f8fafc;
            border-top: 1px solid #e2e8f0;
            border-bottom: 1.5px solid #0f172a;
        }

        table.report-table th {
            padding: 7px 9px;
            font-size: 8.5px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: #0f172a;
            text-align: left;
        }

        table.report-table th.text-right {
            text-align: right;
        }

        table.report-table th.text-center {
            text-align: center;
        }

        table.report-table td {
            padding: 6.5px 9px;
            border-bottom: 1px solid #f1f5f9;
            color: #1e293b;
            vertical-align: middle;
        }

        table.report-table td.text-right {
            text-align: right;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-variant-numeric: tabular-nums;
            font-weight: 600;
        }

        table.report-table td.text-center {
            text-align: center;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        table.report-table tbody tr:nth-child(even) {
            background-color: #fafbfc;
        }

        table.report-table tfoot {
            display: table-row-group;
        }

        table.report-table tfoot tr {
            border-top: 2px solid #0f172a;
            border-bottom: 2px solid #0f172a;
            background-color: #f8fafc;
            font-weight: 800;
            break-inside: avoid;
            page-break-inside: avoid;
        }

        table.report-table tfoot td {
            padding: 8px 9px;
            font-size: 10.5px;
            color: #0f172a;
        }

        /* ─── Two-Column Grid ─── */
        .two-col-grid {
            display: table;
            width: 100%;
            table-layout: fixed;
            margin-bottom: 12px;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .two-col-grid > div {
            display: table-cell;
            vertical-align: top;
            width: 50%;
            padding: 0 7px;
        }

        .two-col-grid > div:first-child {
            padding-left: 0;
            padding-right: 7px;
        }

        .two-col-grid > div:last-child {
            padding-left: 7px;
            padding-right: 0;
        }

        /* ─── Reconciliation & Position Card ─── */
        .reconcile-card {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            background-color: #ffffff;
            overflow: hidden;
            margin-bottom: 14px;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .reconcile-header {
            padding: 8px 12px;
            background-color: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .reconcile-status-badge {
            font-size: 8.5px;
            font-weight: 800;
            text-transform: uppercase;
            padding: 2px 8px;
            border-radius: 4px;
            letter-spacing: 0.05em;
        }

        .badge-reconciled {
            background-color: #ecfdf5;
            color: #047857;
            border: 1px solid #a7f3d0;
        }

        .badge-discrepancy {
            background-color: #fff1f2;
            color: #be123c;
            border: 1px solid #fecdd3;
        }

        /* ─── Corporate Sign-off & Audit Seal ─── */
        .signoff-section {
            margin-top: 22px;
            padding-top: 14px;
            border-top: 1px solid #e2e8f0;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            page-break-inside: avoid;
            break-inside: avoid;
        }

        .signature-box, .stamp-box {
            border: 1px dashed #cbd5e1;
            border-radius: 8px;
            background-color: #fafbfc;
            padding: 12px 14px;
            min-height: 85px;
            position: relative;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }

        .box-title {
            font-size: 8.5px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
        }

        .stamp-preview-img, .signature-preview-img {
            max-height: 52px;
            max-width: 140px;
            object-fit: contain;
            margin: 4px 0;
        }

        .sign-line {
            border-top: 1px solid #0f172a;
            margin-top: 6px;
            padding-top: 4px;
            font-size: 8.5px;
            color: #475569;
            display: flex;
            justify-content: space-between;
        }

        .audit-footer-note {
            margin-top: 12px;
            font-size: 8px;
            color: #94a3b8;
            text-align: center;
            font-style: italic;
        }
    </style>
</head>
<body>
    @php
        $money = fn($v) => number_format((float) ($v ?? 0), 2) . ' ETB';
        $num = fn($v) => number_format((float) ($v ?? 0));
        $netProfit = (float) ($summary['net_profit'] ?? 0);
        $isProfit = $netProfit >= 0;
    @endphp

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
                                <div>
                                    @if(!empty($business['phone']))
                                        <span>Tel: {{ $business['phone'] }}</span>
                                    @endif
                                    @if(!empty($business['email']))
                                        <span> · {{ $business['email'] }}</span>
                                    @endif
                                </div>
                                @if(!empty($business['tin_number']))
                                    <div style="font-family: monospace;">TIN / VAT: {{ $business['tin_number'] }}</div>
                                @endif
                            </div>
                        </div>
                    </td>
                </tr>
            </table>
        </div>

        <div class="doc-title-section">
            <div class="doc-badge">Financial Statement & Audit</div>
            <div class="doc-period">{{ $report['period']['label'] ?? 'All Records' }}</div>
            <div class="doc-meta">Issued: {{ $issuedDate }}</div>
            <div class="doc-meta" style="color: #64748b; font-weight: 600;">Status: Verified Final</div>
        </div>
    </div>

    <!-- ═══ 2. EXECUTIVE PERFORMANCE KPI HIGHLIGHTS ═══ -->
    <table class="kpi-table">
        <tr>
            <td style="width: 25%;">
                <div class="kpi-card">
                    <div class="kpi-label">Gross Revenue</div>
                    <div class="kpi-val">{{ $money($summary['revenue'] ?? 0) }}</div>
                    <div class="kpi-sub">Net: {{ $money($summary['net_revenue'] ?? $summary['revenue'] ?? 0) }}</div>
                </div>
            </td>
            <td style="width: 25%;">
                <div class="kpi-card">
                    <div class="kpi-label">Cost of Goods Sold (COGS)</div>
                    <div class="kpi-val">{{ $money($cogs ?? 0) }}</div>
                    <div class="kpi-sub">Gross Margin: {{ $grossMargin }}%</div>
                </div>
            </td>
            <td style="width: 25%;">
                <div class="kpi-card">
                    <div class="kpi-label">Operating Expenses & Fees</div>
                    <div class="kpi-val" style="color: #be123c;">
                        {{ $money(($summary['operating_expenses'] ?? 0) + ($summary['transaction_fees'] ?? 0)) }}
                    </div>
                    <div class="kpi-sub">Overheads: {{ $money($summary['operating_expenses'] ?? 0) }}</div>
                </div>
            </td>
            <td style="width: 25%;">
                <div class="kpi-card {{ $isProfit ? 'highlight-profit' : 'highlight-loss' }}">
                    <div class="kpi-label">Net Operating {{ $isProfit ? 'Profit' : 'Loss' }}</div>
                    <div class="kpi-val" style="color: {{ $isProfit ? '#047857' : '#be123c' }};">
                        {{ $isProfit ? '+' : '-' }}{{ $money(abs($netProfit)) }}
                    </div>
                    <div class="kpi-sub" style="color: {{ $isProfit ? '#047857' : '#be123c' }}; font-weight: 700;">
                        Net Margin: {{ $netMargin }}%
                    </div>
                </div>
            </td>
        </tr>
    </table>

    <!-- ═══ 3. SECTION: COMMERCIAL ACTIVITY & REVENUE BREAKDOWN ═══ -->
    <div class="section-header">
        <div class="section-title">
            <span>Commercial Activity & Revenue Breakdown</span>
        </div>
        <div class="section-pill">{{ $summary['orders'] ?? 0 }} closed orders · {{ $summary['units_sold'] ?? 0 }} physical units sold</div>
    </div>

    <table class="report-table">
        <thead>
            <tr>
                <th style="width: 70%;">Accounting Line Item / Performance Metric</th>
                <th class="text-right" style="width: 30%;">Result (ETB)</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Sales orders successfully closed</td>
                <td class="text-right">{{ $summary['orders'] ?? 0 }} orders</td>
            </tr>
            <tr>
                <td>Total inventory units sold and delivered</td>
                <td class="text-right">{{ $num($summary['units_sold'] ?? 0) }} units</td>
            </tr>
            <tr>
                <td>Average order value (AOV)</td>
                <td class="text-right">{{ $money($summary['average_order_value'] ?? 0) }}</td>
            </tr>
            <tr style="font-weight: 700; background-color: #f8fafc;">
                <td>Total gross sales revenue</td>
                <td class="text-right" style="color: #0f172a;">{{ $money($summary['revenue'] ?? 0) }}</td>
            </tr>
            @if(($summary['discounts'] ?? 0) > 0)
                <tr>
                    <td style="color: #475569; padding-left: 20px;">› Customer discounts allowed</td>
                    <td class="text-right" style="color: #d97706;">-{{ $money($summary['discounts'] ?? 0) }}</td>
                </tr>
            @endif
            @if(($summary['write_offs'] ?? 0) > 0)
                <tr>
                    <td style="color: #475569; padding-left: 20px;">› Intentional price concessions & write-offs</td>
                    <td class="text-right" style="color: #be123c;">-{{ $money($summary['write_offs'] ?? 0) }}</td>
                </tr>
            @endif
            <tr>
                <td style="font-weight: 600;">Net sales revenue realized</td>
                <td class="text-right" style="font-weight: 700;">{{ $money($summary['net_revenue'] ?? ($summary['revenue'] - ($summary['discounts'] ?? 0) - ($summary['write_offs'] ?? 0))) }}</td>
            </tr>
            <tr>
                <td>Cost of goods sold (inventory purchase cost)</td>
                <td class="text-right" style="color: #475569;">-{{ $money($cogs ?? 0) }}</td>
            </tr>
            <tr style="background-color: #f1f5f9; font-weight: 700;">
                <td>Gross profit margin after product cost</td>
                <td class="text-right" style="color: {{ ($summary['gross_profit'] ?? 0) >= 0 ? '#047857' : '#be123c' }};">
                    {{ $money($summary['gross_profit'] ?? 0) }}
                </td>
            </tr>
            <tr>
                <td>Operating overhead expenses (rent, utilities, operational costs)</td>
                <td class="text-right" style="color: #be123c;">-{{ $money($summary['operating_expenses'] ?? 0) }}</td>
            </tr>
            <tr>
                <td>Payment gateway, bank transfer & transaction fees</td>
                <td class="text-right" style="color: #be123c;">-{{ $money($summary['transaction_fees'] ?? 0) }}</td>
            </tr>
        </tbody>
        <tfoot>
            <tr>
                <td style="text-transform: uppercase; letter-spacing: 0.05em; font-size: 11px;">
                    Net Realized Operating Profit
                </td>
                <td class="text-right" style="font-size: 13px; color: {{ $isProfit ? '#047857' : '#be123c' }};">
                    {{ $money($netProfit) }}
                </td>
            </tr>
            @if(($summary['owner_draws'] ?? 0) > 0)
                <tr style="background-color: #f8fafc; font-size: 9.5px; border-top: 1px dashed #cbd5e1;">
                    <td style="color: #64748b; font-style: italic;">Owner equity withdrawals (recorded separately)</td>
                    <td class="text-right" style="color: #b45309; font-weight: 600;">-{{ $money($summary['owner_draws']) }}</td>
                </tr>
            @endif
        </tfoot>
    </table>

    <!-- ═══ 4. SECTION: BELOW-COST SALES AUDIT (IF APPLICABLE) ═══ -->
    @if(!empty($summary['loss_making_items']) && count($summary['loss_items'] ?? []) > 0)
        <div class="section-header" style="border-bottom-color: #f43f5e;">
            <div class="section-title" style="color: #be123c;">
                <span>Below-Cost Sales & Concessions Audit</span>
                <span class="section-pill" style="background-color: #ffe4e6; color: #be123c;">
                    {{ $summary['loss_making_items'] }} units · Total Loss: -{{ $money($summary['loss_amount'] ?? 0) }}
                </span>
            </div>
        </div>

        <table class="report-table" style="border: 1px solid #fecdd3;">
            <thead>
                <tr style="background-color: #fff1f2; border-bottom: 1.5px solid #f43f5e;">
                    <th>Product / Model</th>
                    <th>Identifier / Order #</th>
                    <th>Date</th>
                    <th class="text-right">Unit Sale Price</th>
                    <th class="text-right">Unit Purchase Cost</th>
                    <th class="text-right">Loss Concession</th>
                </tr>
            </thead>
            <tbody>
                @foreach(array_slice($summary['loss_items'], 0, 10) as $item)
                    <tr>
                        <td style="font-weight: 600; color: #881337;">{{ $item['product'] ?? 'Item' }}</td>
                        <td style="font-family: monospace; font-size: 9px; color: #64748b;">
                            {{ $item['imei_or_serial'] ?? $item['order_number'] ?? '—' }}
                        </td>
                        <td style="font-family: monospace; font-size: 9px;">{{ $item['order_date'] ?? '—' }}</td>
                        <td class="text-right">{{ $money($item['unit_price'] ?? 0) }}</td>
                        <td class="text-right">{{ $money($item['unit_cost'] ?? 0) }}</td>
                        <td class="text-right" style="color: #be123c; font-weight: 700;">-{{ $money($item['loss'] ?? 0) }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif

    <!-- ═══ 5. SECTION: INVENTORY & STOCK VALUATION ═══ -->
    <div class="two-col-grid">
        <!-- Left: Inventory Stock Valuation -->
        <div>
            <div class="section-header">
                <div class="section-title">
                    <span>Stock & Inventory Valuation</span>
                </div>
                <div class="section-pill">As of period end</div>
            </div>

            <table class="report-table">
                <thead>
                    <tr>
                        <th>Holdings Classification</th>
                        <th class="text-right">Units</th>
                        <th class="text-right">Valuation (Cost)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Shop-owned stock on shelf</td>
                        <td class="text-right">{{ $report['stock_position']['owned_units'] ?? 0 }}</td>
                        <td class="text-right">{{ $money($report['stock_position']['owned_value'] ?? 0) }}</td>
                    </tr>
                    <tr>
                        <td>Vendor consignment in custody</td>
                        <td class="text-right">{{ $report['stock_position']['vendor_units'] ?? 0 }}</td>
                        <td class="text-right" style="color: #2563eb;">{{ $money($report['stock_position']['vendor_value'] ?? 0) }}</td>
                    </tr>
                    <tr>
                        <td>Defective / in-repair stock units</td>
                        <td class="text-right">{{ $report['repairs']['reported_count'] ?? 0 }}</td>
                        <td class="text-right" style="color: #d97706;">Repair exp: {{ $money($report['repairs']['repair_expense'] ?? 0) }}</td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr>
                        <td>Total Shelf Stock Holdings</td>
                        <td class="text-right">
                            {{ ($report['stock_position']['owned_units'] ?? 0) + ($report['stock_position']['vendor_units'] ?? 0) }}
                        </td>
                        <td class="text-right" style="color: #047857;">
                            {{ $money($report['stock_position']['owned_value'] ?? 0) }}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>

        <!-- Right: Liquidity & Cash Balances -->
        <div>
            <div class="section-header">
                <div class="section-title">
                    <span>Liquidity & Bank Accounts</span>
                </div>
                <div class="section-pill">{{ count($report['cash_position']['accounts'] ?? []) }} accounts</div>
            </div>

            <table class="report-table">
                <thead>
                    <tr>
                        <th>Account Name & Institution</th>
                        <th class="text-center">Type</th>
                        <th class="text-right">Current Balance</th>
                    </tr>
                </thead>
                <tbody>
                    @php $accounts = array_slice($report['cash_position']['accounts'] ?? [], 0, 5); @endphp
                    @forelse($accounts as $acc)
                        <tr>
                            <td style="font-weight: 600;">{{ $acc['name'] ?? 'Account' }}</td>
                            <td class="text-center" style="font-size: 8.5px; text-transform: uppercase; color: #64748b;">
                                {{ $acc['type'] ?? 'bank' }}
                            </td>
                            <td class="text-right" style="color: {{ ($acc['balance'] ?? 0) >= 0 ? '#0f172a' : '#be123c' }};">
                                {{ $money($acc['balance'] ?? 0) }}
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="3" style="text-align: center; color: #94a3b8; font-style: italic;">No active financial accounts</td>
                        </tr>
                    @endforelse
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="2">Total Liquid Cash & Bank Reserves</td>
                        <td class="text-right" style="color: #047857;">
                            {{ $money($report['cash_position']['total_balance'] ?? 0) }}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </div>

    <!-- ═══ 6. SECTION: BALANCE RECONCILIATION & AUDIT VERIFICATION ═══ -->
    @if(!empty($report['reconciliation']))
        @php
            $rec = $report['reconciliation'];
            $isReconciled = !empty($rec['is_reconciled']);
        @endphp
        <div class="reconcile-card">
            <div class="reconcile-header">
                <div style="font-size: 9.5pt; font-weight: 800; text-transform: uppercase; color: #0f172a;">
                    Balance Reconciliation & Audit Trail
                </div>
                <div class="reconcile-status-badge {{ $isReconciled ? 'badge-reconciled' : 'badge-discrepancy' }}">
                    {{ $isReconciled ? 'Zero Variance · Perfectly Reconciled' : 'Discrepancy: ' . $money(abs($rec['variance'] ?? 0)) }}
                </div>
            </div>

            <table class="report-table" style="margin-bottom: 0;">
                <thead>
                    <tr>
                        <th style="width: 50%;">Audit Flow Milestone</th>
                        <th class="text-right" style="width: 25%;">Transaction Flow</th>
                        <th class="text-right" style="width: 25%;">Cumulative Running</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="font-weight: 600;">Opening cash balance at start of audit period</td>
                        <td class="text-right">—</td>
                        <td class="text-right">{{ $money($rec['opening_balance'] ?? 0) }}</td>
                    </tr>
                    @if(($rec['capital_deposits'] ?? 0) > 0)
                        <tr>
                            <td>(+) Capital investments & owner deposits</td>
                            <td class="text-right" style="color: #047857;">+{{ $money($rec['capital_deposits']) }}</td>
                            <td class="text-right">—</td>
                        </tr>
                    @endif
                    <tr>
                        <td>(+) Inflow from verified customer collections & cash sales</td>
                        <td class="text-right" style="color: #047857;">+{{ $money($rec['customer_collections'] ?? 0) }}</td>
                        <td class="text-right">—</td>
                    </tr>
                    @if(($rec['borrowed_funds'] ?? 0) > 0)
                        <tr>
                            <td>(+) Loan borrowings & incoming credit facilities</td>
                            <td class="text-right" style="color: #047857;">+{{ $money($rec['borrowed_funds']) }}</td>
                            <td class="text-right">—</td>
                        </tr>
                    @endif
                    <tr>
                        <td>(-) Outflow for vendor consignment & supplier settlement</td>
                        <td class="text-right" style="color: #be123c;">-{{ $money($rec['supplier_payments'] ?? 0) }}</td>
                        <td class="text-right">—</td>
                    </tr>
                    @if(($rec['operating_expenses'] ?? 0) > 0)
                        <tr>
                            <td>(-) Operating overhead & utility expense payments</td>
                            <td class="text-right" style="color: #be123c;">-{{ $money($rec['operating_expenses']) }}</td>
                            <td class="text-right">—</td>
                        </tr>
                    @endif
                    @if(($rec['owner_draws'] ?? 0) > 0)
                        <tr>
                            <td>(-) Owner equity dividend drawings</td>
                            <td class="text-right" style="color: #d97706;">-{{ $money($rec['owner_draws']) }}</td>
                            <td class="text-right">—</td>
                        </tr>
                    @endif
                    @if(($rec['transaction_fees'] ?? 0) > 0)
                        <tr>
                            <td>(-) Payment gateway and bank transfer fees</td>
                            <td class="text-right" style="color: #be123c;">-{{ $money($rec['transaction_fees']) }}</td>
                            <td class="text-right">—</td>
                        </tr>
                    @endif
                </tbody>
                <tfoot>
                    <tr>
                        <td>Computed Balance vs Physical Closing Balance</td>
                        <td class="text-right" style="font-size: 10px; color: {{ $isReconciled ? '#047857' : '#be123c' }};">
                            Variance: {{ $money($rec['variance'] ?? 0) }}
                        </td>
                        <td class="text-right" style="font-size: 11.5px; color: #0f172a;">
                            {{ $money($rec['closing_balance'] ?? 0) }}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    @endif

    <!-- ═══ 7. SECTION: STAFF PERFORMANCE & VENDOR CONSIGNMENT ═══ -->
    <div class="two-col-grid">
        <!-- Staff Performance -->
        <div>
            <div class="section-header">
                <div class="section-title">
                    <span>Staff Sales Contribution</span>
                </div>
                <div class="section-pill">{{ count($report['staff_performance'] ?? []) }} team members</div>
            </div>

            <table class="report-table">
                <thead>
                    <tr>
                        <th>Salesperson</th>
                        <th class="text-center">Orders</th>
                        <th class="text-center">Units</th>
                        <th class="text-right">Revenue</th>
                        <th class="text-right">Profit</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse(array_slice($report['staff_performance'] ?? [], 0, 5) as $staff)
                        <tr>
                            <td style="font-weight: 600;">{{ $staff['name'] ?? 'Staff' }}</td>
                            <td class="text-center">{{ $staff['orders'] ?? 0 }}</td>
                            <td class="text-center">{{ $staff['units'] ?? 0 }}</td>
                            <td class="text-right">{{ $money($staff['revenue'] ?? 0) }}</td>
                            <td class="text-right" style="color: #047857;">{{ $money($staff['profit'] ?? 0) }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="5" style="text-align: center; color: #94a3b8; font-style: italic;">No separate staff sales records</td>
                        </tr>
                    @endforelse
                </tbody>
                @if(!empty($staffTotals['orders']))
                    <tfoot>
                        <tr>
                            <td>Total Staff Sales</td>
                            <td class="text-center">{{ $staffTotals['orders'] }}</td>
                            <td class="text-center">{{ $staffTotals['units'] }}</td>
                            <td class="text-right">{{ $money($staffTotals['revenue']) }}</td>
                            <td class="text-right" style="color: #047857;">{{ $money($staffTotals['profit']) }}</td>
                        </tr>
                    </tfoot>
                @endif
            </table>
        </div>

        <!-- Vendor Consignment -->
        <div>
            <div class="section-header">
                <div class="section-title">
                    <span>Vendor Consignment Activity</span>
                </div>
                <div class="section-pill">{{ count($report['vendor_activity']['vendors'] ?? []) }} suppliers</div>
            </div>

            <table class="report-table">
                <thead>
                    <tr>
                        <th>Partner / Supplier</th>
                        <th class="text-center">Rcvd</th>
                        <th class="text-center">Sold</th>
                        <th class="text-right">Revenue</th>
                        <th class="text-center">Ret</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse(array_slice($report['vendor_activity']['vendors'] ?? [], 0, 5) as $vnd)
                        <tr>
                            <td style="font-weight: 600;">{{ $vnd['name'] ?? 'Partner' }}</td>
                            <td class="text-center">{{ $vnd['received_units'] ?? 0 }}</td>
                            <td class="text-center" style="color: #047857; font-weight: 700;">{{ $vnd['units_sold'] ?? 0 }}</td>
                            <td class="text-right">{{ $money($vnd['revenue'] ?? 0) }}</td>
                            <td class="text-center" style="color: #94a3b8;">{{ $vnd['returned_units'] ?? 0 }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="5" style="text-align: center; color: #94a3b8; font-style: italic;">No vendor consignment activity</td>
                        </tr>
                    @endforelse
                </tbody>
                @if(!empty($vendorTotals['received']) || !empty($vendorTotals['sold']))
                    <tfoot>
                        <tr>
                            <td>Total Consignment Volume</td>
                            <td class="text-center">{{ $vendorTotals['received'] }}</td>
                            <td class="text-center" style="color: #047857;">{{ $vendorTotals['sold'] }}</td>
                            <td class="text-right">{{ $money($vendorTotals['revenue']) }}</td>
                            <td class="text-center">{{ $vendorTotals['returned'] }}</td>
                        </tr>
                    </tfoot>
                @endif
            </table>
        </div>
    </div>

    <!-- ═══ 8. OFFICIAL CORPORATE SIGN-OFF & VERIFICATION ═══ -->
    <div class="signoff-section">
        <!-- Authorized Management Signature -->
        <div class="signature-box">
            <div class="box-title">Certified Management Signature</div>
            @if(!empty($signatureBase64))
                <img src="{{ $signatureBase64 }}" alt="Signature" class="signature-preview-img">
            @else
                <div style="height: 38px;"></div>
            @endif
            <div class="sign-line">
                <span>Authorized Financial Officer</span>
                <span>Date: {{ $issuedDate }}</span>
            </div>
        </div>

        <!-- Official Corporate Stamp & Seal -->
        <div class="stamp-box">
            <div class="box-title">Official Corporate Stamp & Seal</div>
            @if(!empty($stampBase64))
                <img src="{{ $stampBase64 }}" alt="Official Stamp" class="stamp-preview-img">
            @else
                <div style="height: 38px;"></div>
            @endif
            <div class="sign-line">
                <span>Verified Audit Ledger Stamp</span>
                <span>Audit Ref: #{{ strtoupper(substr(md5($from . $to), 0, 8)) }}</span>
            </div>
        </div>
    </div>

    <div class="audit-footer-note">
        This document represents an official accounting and inventory audit generated from verified ledger transactions.
        Confidential and proprietary to {{ $business['name'] }}.
    </div>
</body>
</html>
