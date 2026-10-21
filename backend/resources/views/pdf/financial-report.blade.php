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
            width: 58%;
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
            width: 42%;
            text-align: right;
        }

        .doc-badge {
            display: inline-block;
            font-size: 10.5pt;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #0f172a;
            line-height: 1.2;
        }

        .doc-period {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 10px;
            font-weight: 700;
            color: #047857;
            background-color: #ecfdf5;
            padding: 2px 8px;
            border-radius: 4px;
            border: 1px solid #a7f3d0;
            display: inline-block;
            margin-top: 3px;
        }

        .doc-meta {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 9px;
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
            padding: 8px 11px;
            min-height: 62px;
        }

        .kpi-card.highlight-profit {
            background-color: #f0fdf4;
            border-color: #bbf7d0;
        }

        .kpi-card.highlight-loss {
            background-color: #fff1f2;
            border-color: #fecdd3;
        }

        .kpi-card.highlight-indigo {
            background-color: #f5f3ff;
            border-color: #ddd6fe;
        }

        .kpi-label {
            font-size: 8px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            margin-bottom: 2px;
        }

        .kpi-val {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 11.5pt;
            font-weight: 800;
            color: #0f172a;
            font-variant-numeric: tabular-nums;
            letter-spacing: -0.3px;
        }

        .kpi-sub {
            font-size: 8px;
            color: #64748b;
            margin-top: 2px;
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
            font-size: 9.5px;
            margin-bottom: 12px;
        }

        table.report-table thead tr {
            background-color: #f8fafc;
            border-top: 1px solid #e2e8f0;
            border-bottom: 1.5px solid #0f172a;
        }

        table.report-table th {
            padding: 6.5px 8px;
            font-size: 8px;
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

        table.report-table tr {
            page-break-inside: avoid;
            break-inside: avoid;
        }

        table.report-table td {
            padding: 6px 8px;
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
            page-break-inside: avoid;
            break-inside: avoid;
        }

        table.report-table tfoot tr {
            border-top: 2px solid #0f172a;
            border-bottom: 2px solid #0f172a;
            background-color: #f8fafc;
            font-weight: 800;
        }

        table.report-table tfoot td {
            padding: 7px 8px;
            font-size: 10px;
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
            margin-top: 20px;
            padding-top: 12px;
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
            padding: 10px 12px;
            min-height: 80px;
            position: relative;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }

        .box-title {
            font-size: 8px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
        }

        .stamp-preview-img, .signature-preview-img {
            max-height: 48px;
            max-width: 140px;
            object-fit: contain;
            margin: 4px 0;
        }

        .sign-line {
            border-top: 1px solid #0f172a;
            margin-top: 6px;
            padding-top: 4px;
            font-size: 8px;
            color: #475569;
            display: flex;
            justify-content: space-between;
        }

        .audit-footer-note {
            margin-top: 10px;
            font-size: 7.5px;
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
        $sec = $section ?? 'all';

        $acc = $report['accessory_comparison'] ?? null;
        $stock = $report['stock_position'] ?? [];
        $repairs = $report['repairs'] ?? [];
        $cash = $report['cash_position'] ?? [];
        $finPos = $report['financial_position'] ?? null;
        $rec = $report['reconciliation'] ?? null;
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
            <div class="doc-badge">{{ $reportTitle ?? 'Financial Statement & Audit' }}</div>
            <div class="doc-period">{{ $report['period']['label'] ?? 'All Records' }}</div>
            <div class="doc-meta">Issued: {{ $issuedDate }}</div>
            <div class="doc-meta" style="color: #64748b; font-weight: 600;">Status: Verified Final</div>
        </div>
    </div>

    <!-- ═══ 2. EXECUTIVE PERFORMANCE KPI HIGHLIGHTS ═══ -->
    <table class="kpi-table">
        <tr>
            @if($sec === 'all' || $sec === 'sales')
                <td style="width: 25%;">
                    <div class="kpi-card">
                        <div class="kpi-label">Gross Revenue</div>
                        <div class="kpi-val">{{ $money($summary['revenue'] ?? 0) }}</div>
                        <div class="kpi-sub">Net: {{ $money($summary['net_revenue'] ?? $summary['revenue'] ?? 0) }}</div>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="kpi-card">
                        <div class="kpi-label">Cost of Goods Sold</div>
                        <div class="kpi-val">{{ $money($cogs ?? 0) }}</div>
                        <div class="kpi-sub">Gross Margin: {{ $grossMargin }}%</div>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="kpi-card">
                        <div class="kpi-label">Expenses & Fees</div>
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
            @elseif($sec === 'accessory')
                <td style="width: 25%;">
                    <div class="kpi-card highlight-indigo">
                        <div class="kpi-label">Attachment Rate</div>
                        <div class="kpi-val" style="color: #4338ca;">{{ $acc['attachment_rate'] ?? 0 }}%</div>
                        <div class="kpi-sub">Of completed sales orders</div>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="kpi-card">
                        <div class="kpi-label">Bundled Order AOV</div>
                        <div class="kpi-val">{{ $money($acc['with_accessories']['avg_order_value'] ?? 0) }}</div>
                        <div class="kpi-sub">Standalone: {{ $money($acc['without_accessories']['avg_order_value'] ?? 0) }}</div>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="kpi-card">
                        <div class="kpi-label">Average Profit Diff</div>
                        <div class="kpi-val" style="color: {{ ($acc['profit_difference'] ?? 0) >= 0 ? '#047857' : '#d97706' }};">
                            {{ ($acc['profit_difference'] ?? 0) >= 0 ? '+' : '' }}{{ $money($acc['profit_difference'] ?? 0) }}
                        </div>
                        <div class="kpi-sub">Per device with bundle</div>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="kpi-card highlight-profit">
                        <div class="kpi-label">Bundled Net Profit</div>
                        <div class="kpi-val" style="color: #047857;">{{ $money($acc['with_accessories']['profit'] ?? 0) }}</div>
                        <div class="kpi-sub">Margin: {{ $acc['with_accessories']['margin_percent'] ?? 0 }}%</div>
                    </div>
                </td>
            @elseif($sec === 'inventory')
                <td style="width: 25%;">
                    <div class="kpi-card highlight-profit">
                        <div class="kpi-label">Owned Stock Valuation</div>
                        <div class="kpi-val" style="color: #047857;">{{ $money($stock['owned_value'] ?? 0) }}</div>
                        <div class="kpi-sub">Valuation at purchase cost</div>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="kpi-card">
                        <div class="kpi-label">Shop-Owned Stock</div>
                        <div class="kpi-val">{{ $num($stock['owned_units'] ?? 0) }}</div>
                        <div class="kpi-sub">Physical units owned</div>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="kpi-card">
                        <div class="kpi-label">Vendor Consignment</div>
                        <div class="kpi-val" style="color: #2563eb;">{{ $num($stock['vendor_units'] ?? 0) }}</div>
                        <div class="kpi-sub">Val: {{ $money($stock['vendor_value'] ?? 0) }}</div>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="kpi-card">
                        <div class="kpi-label">Total Shelf Holdings</div>
                        <div class="kpi-val">{{ $num(($stock['owned_units'] ?? 0) + ($stock['vendor_units'] ?? 0)) }}</div>
                        <div class="kpi-sub">Total devices in custody</div>
                    </div>
                </td>
            @elseif($sec === 'staff')
                <td style="width: 25%;">
                    <div class="kpi-card">
                        <div class="kpi-label">Total Staff Revenue</div>
                        <div class="kpi-val">{{ $money($staffTotals['revenue'] ?? 0) }}</div>
                        <div class="kpi-sub">Closed staff sales</div>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="kpi-card highlight-profit">
                        <div class="kpi-label">Realized Gross Profit</div>
                        <div class="kpi-val" style="color: #047857;">{{ $money($staffTotals['profit'] ?? 0) }}</div>
                        <div class="kpi-sub">Total team margin</div>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="kpi-card">
                        <div class="kpi-label">Closed Sales Orders</div>
                        <div class="kpi-val">{{ $num($staffTotals['orders'] ?? 0) }}</div>
                        <div class="kpi-sub">Transactions finalized</div>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="kpi-card">
                        <div class="kpi-label">Delivered Units</div>
                        <div class="kpi-val">{{ $num($staffTotals['units'] ?? 0) }}</div>
                        <div class="kpi-sub">Across {{ count($report['staff_performance'] ?? []) }} sellers</div>
                    </div>
                </td>
            @elseif($sec === 'vendors')
                <td style="width: 25%;">
                    <div class="kpi-card">
                        <div class="kpi-label">Consignment Inflow</div>
                        <div class="kpi-val">{{ $num($vendorTotals['received'] ?? 0) }}</div>
                        <div class="kpi-sub">Units intake from vendors</div>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="kpi-card highlight-profit">
                        <div class="kpi-label">Consigned Units Sold</div>
                        <div class="kpi-val" style="color: #047857;">{{ $num($vendorTotals['sold'] ?? 0) }}</div>
                        <div class="kpi-sub">Turnaround to customers</div>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="kpi-card">
                        <div class="kpi-label">Realized Sales Value</div>
                        <div class="kpi-val">{{ $money($vendorTotals['revenue'] ?? 0) }}</div>
                        <div class="kpi-sub">Gross consignment volume</div>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="kpi-card">
                        <div class="kpi-label">Returned to Vendors</div>
                        <div class="kpi-val" style="color: #64748b;">{{ $num($vendorTotals['returned'] ?? 0) }}</div>
                        <div class="kpi-sub">Active suppliers: {{ count($report['vendor_activity']['vendors'] ?? []) }}</div>
                    </div>
                </td>
            @elseif($sec === 'repairs')
                <td style="width: 25%;">
                    <div class="kpi-card">
                        <div class="kpi-label">Defects / Returns</div>
                        <div class="kpi-val" style="color: #d97706;">{{ $num($repairs['reported_count'] ?? 0) }}</div>
                        <div class="kpi-sub">Reported intake items</div>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="kpi-card highlight-profit">
                        <div class="kpi-label">Repairs Completed</div>
                        <div class="kpi-val" style="color: #047857;">{{ $num($repairs['repaired_count'] ?? 0) }}</div>
                        <div class="kpi-sub">Serviced & resolved</div>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="kpi-card">
                        <div class="kpi-label">Resolution Rate</div>
                        <div class="kpi-val">
                            {{ ($repairs['reported_count'] ?? 0) > 0 ? round((($repairs['repaired_count'] ?? 0) / $repairs['reported_count']) * 100) . '%' : '100%' }}
                        </div>
                        <div class="kpi-sub">Fulfillment rate</div>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="kpi-card highlight-loss">
                        <div class="kpi-label">Total Repair Expense</div>
                        <div class="kpi-val" style="color: #be123c;">{{ $money($repairs['repair_expense'] ?? 0) }}</div>
                        <div class="kpi-sub">Total service expenditure</div>
                    </div>
                </td>
            @elseif($sec === 'accounts')
                <td style="width: 25%;">
                    <div class="kpi-card highlight-profit">
                        <div class="kpi-label">Cash & Bank Balances</div>
                        <div class="kpi-val" style="color: #047857;">{{ $money($cash['cash_and_bank'] ?? $cash['total_balance'] ?? 0) }}</div>
                        <div class="kpi-sub">Liquid settlements</div>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="kpi-card">
                        <div class="kpi-label">Custom Assets</div>
                        <div class="kpi-val" style="color: #d97706;">{{ $money($cash['custom_assets'] ?? 0) }}</div>
                        <div class="kpi-sub">Store capital & assets</div>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="kpi-card">
                        <div class="kpi-label">Total Account Reserves</div>
                        <div class="kpi-val">{{ $money($cash['total_liquidity_and_assets'] ?? $cash['total_balance'] ?? 0) }}</div>
                        <div class="kpi-sub">Liquid + Custom Assets</div>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="kpi-card">
                        <div class="kpi-label">Active Ledgers</div>
                        <div class="kpi-val">{{ count($cash['accounts'] ?? []) }}</div>
                        <div class="kpi-sub">Financial accounts</div>
                    </div>
                </td>
            @elseif($sec === 'position')
                <td style="width: 25%;">
                    <div class="kpi-card highlight-profit">
                        <div class="kpi-label">Total Owned Assets</div>
                        <div class="kpi-val" style="color: #047857;">{{ $money($finPos['assets']['total'] ?? 0) }}</div>
                        <div class="kpi-sub">Cash, stock & receivables</div>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="kpi-card">
                        <div class="kpi-label">Liquid Reserves</div>
                        <div class="kpi-val">{{ $money($finPos['assets']['cash_and_bank'] ?? 0) }}</div>
                        <div class="kpi-sub">Bank & cash on hand</div>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="kpi-card highlight-loss">
                        <div class="kpi-label">Open Liabilities</div>
                        <div class="kpi-val" style="color: #be123c;">-{{ $money($finPos['liabilities']['open_payables'] ?? 0) }}</div>
                        <div class="kpi-sub">{{ $finPos['liabilities']['open_payable_count'] ?? count($finPos['liabilities']['payables'] ?? []) }} open debts</div>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="kpi-card {{ ($finPos['net_position'] ?? 0) >= 0 ? 'highlight-profit' : 'highlight-loss' }}">
                        <div class="kpi-label">Net Financial Worth</div>
                        <div class="kpi-val" style="color: {{ ($finPos['net_position'] ?? 0) >= 0 ? '#047857' : '#be123c' }};">
                            {{ $money($finPos['net_position'] ?? 0) }}
                        </div>
                        <div class="kpi-sub">Assets minus Liabilities</div>
                    </div>
                </td>
            @elseif($sec === 'reconciliation')
                <td style="width: 25%;">
                    <div class="kpi-card">
                        <div class="kpi-label">Opening Liquid Balance</div>
                        <div class="kpi-val">{{ $money($rec['opening_balance'] ?? 0) }}</div>
                        <div class="kpi-sub">Base at period start</div>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="kpi-card highlight-profit">
                        <div class="kpi-label">Total Cash Inflows</div>
                        <div class="kpi-val" style="color: #047857;">
                            +{{ $money(($rec['capital_deposits'] ?? 0) + ($rec['customer_collections'] ?? 0) + ($rec['borrowed_funds'] ?? 0) + ($rec['other_income'] ?? 0)) }}
                        </div>
                        <div class="kpi-sub">Verified ledger deposits</div>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="kpi-card highlight-loss">
                        <div class="kpi-label">Total Cash Outflows</div>
                        <div class="kpi-val" style="color: #be123c;">
                            -{{ $money(($rec['supplier_payments'] ?? 0) + ($rec['operating_expenses'] ?? 0) + ($rec['owner_draws'] ?? 0) + ($rec['loan_disbursements'] ?? 0) + ($rec['transaction_fees'] ?? 0)) }}
                        </div>
                        <div class="kpi-sub">Disbursements & fees</div>
                    </div>
                </td>
                <td style="width: 25%;">
                    <div class="kpi-card {{ !empty($rec['is_reconciled']) ? 'highlight-profit' : 'highlight-loss' }}">
                        <div class="kpi-label">Closing Balance</div>
                        <div class="kpi-val" style="color: {{ !empty($rec['is_reconciled']) ? '#047857' : '#be123c' }};">
                            {{ $money($rec['closing_balance'] ?? 0) }}
                        </div>
                        <div class="kpi-sub">
                            {{ !empty($rec['is_reconciled']) ? 'Zero Variance' : 'Variance: ' . $money($rec['variance'] ?? 0) }}
                        </div>
                    </div>
                </td>
            @endif
        </tr>
    </table>

    {{-- ═══ 3. SECTION: COMMERCIAL ACTIVITY & REVENUE (for 'all' or 'sales') ═══ --}}
    @if($sec === 'all' || $sec === 'sales')
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
                <tr>
                    <td>Customer receipts recorded</td>
                    <td class="text-right">{{ $money($summary['customer_receipts'] ?? 0) }}</td>
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
                    @foreach(array_slice($summary['loss_items'], 0, 15) as $item)
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
    @endif

    {{-- ═══ 4. SECTION: ACCESSORY & BUNDLE COMPARISON ═══ --}}
    @if(($sec === 'accessory' || ($sec === 'all' && !empty($acc['has_data']))) && !empty($acc))
        <div class="section-header">
            <div class="section-title">
                <span>Bundles vs Standalone Sales Comparison</span>
            </div>
            <div class="section-pill">{{ $acc['attachment_rate'] ?? 0 }}% Attachment Rate</div>
        </div>

        <table class="report-table">
            <thead>
                <tr>
                    <th style="width: 38%;">Performance Metric</th>
                    <th class="text-right" style="width: 22%;">Sold With Accessories</th>
                    <th class="text-right" style="width: 22%;">Standalone (No Add-ons)</th>
                    <th class="text-right" style="width: 18%;">Comparison</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="font-weight: 600;">Orders Count</td>
                    <td class="text-right">{{ $acc['with_accessories']['orders_count'] ?? 0 }} orders</td>
                    <td class="text-right">{{ $acc['without_accessories']['orders_count'] ?? 0 }} orders</td>
                    <td class="text-right" style="color: #64748b;">{{ $acc['attachment_rate'] ?? 0 }}% of total</td>
                </tr>
                <tr>
                    <td style="font-weight: 600;">Average Order Value (AOV)</td>
                    <td class="text-right">{{ $money($acc['with_accessories']['avg_order_value'] ?? 0) }}</td>
                    <td class="text-right">{{ $money($acc['without_accessories']['avg_order_value'] ?? 0) }}</td>
                    <td class="text-right" style="color: #4f46e5; font-weight: 700;">
                        {{ (($acc['with_accessories']['avg_order_value'] ?? 0) >= ($acc['without_accessories']['avg_order_value'] ?? 0)) ? '+' : '' }}{{ $money(($acc['with_accessories']['avg_order_value'] ?? 0) - ($acc['without_accessories']['avg_order_value'] ?? 0)) }}
                    </td>
                </tr>
                <tr>
                    <td style="font-weight: 600;">Average Profit per Order</td>
                    <td class="text-right" style="font-weight: 700;">{{ $money($acc['with_accessories']['avg_profit_per_order'] ?? 0) }}</td>
                    <td class="text-right" style="font-weight: 700;">{{ $money($acc['without_accessories']['avg_profit_per_order'] ?? 0) }}</td>
                    <td class="text-right" style="color: {{ ($acc['profit_difference'] ?? 0) >= 0 ? '#047857' : '#d97706' }}; font-weight: 700;">
                        {{ ($acc['profit_difference'] ?? 0) >= 0 ? '+' : '' }}{{ $money($acc['profit_difference'] ?? 0) }}
                    </td>
                </tr>
                <tr>
                    <td style="font-weight: 600;">Profit Margin %</td>
                    <td class="text-right">{{ $acc['with_accessories']['margin_percent'] ?? 0 }}%</td>
                    <td class="text-right">{{ $acc['without_accessories']['margin_percent'] ?? 0 }}%</td>
                    <td class="text-right" style="color: #64748b;">
                        {{ number_format(($acc['with_accessories']['margin_percent'] ?? 0) - ($acc['without_accessories']['margin_percent'] ?? 0), 1) }}% diff
                    </td>
                </tr>
                <tr>
                    <td style="font-weight: 600;">Total Net Revenue</td>
                    <td class="text-right" style="font-weight: 700;">{{ $money($acc['with_accessories']['net_revenue'] ?? 0) }}</td>
                    <td class="text-right" style="font-weight: 700;">{{ $money($acc['without_accessories']['net_revenue'] ?? 0) }}</td>
                    <td class="text-right" style="color: #64748b;">—</td>
                </tr>
                <tr>
                    <td style="font-weight: 600;">Total Realized Profit</td>
                    <td class="text-right" style="font-weight: 800; color: {{ ($acc['with_accessories']['profit'] ?? 0) >= 0 ? '#047857' : '#be123c' }};">
                        {{ $money($acc['with_accessories']['profit'] ?? 0) }}
                    </td>
                    <td class="text-right" style="font-weight: 800; color: {{ ($acc['without_accessories']['profit'] ?? 0) >= 0 ? '#047857' : '#be123c' }};">
                        {{ $money($acc['without_accessories']['profit'] ?? 0) }}
                    </td>
                    <td class="text-right" style="color: #64748b;">—</td>
                </tr>
                @if(!empty($acc['with_accessories']['giveaway_count']))
                    <tr style="background-color: #fffbeb;">
                        <td style="color: #92400e; font-weight: 600;">Promotional Giveaways (0 ETB gifts)</td>
                        <td class="text-right" style="color: #92400e;">
                            {{ $acc['with_accessories']['giveaway_count'] }} gifted · {{ $money($acc['with_accessories']['giveaway_cost'] ?? 0) }} cost
                        </td>
                        <td class="text-right" style="color: #94a3b8;">None</td>
                        <td class="text-right" style="color: #b45309; font-size: 8.5px;">Absorbed from margin</td>
                    </tr>
                @endif
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="4" style="font-size: 9px; color: #334155;">
                        <span style="font-weight: 800; color: #0f172a;">Commercial Verdict: </span>
                        @if(($acc['with_accessories']['orders_count'] ?? 0) === 0)
                            <span>No bundled accessory sales recorded in this period.</span>
                        @elseif(($acc['profit_difference'] ?? 0) > 0)
                            <span style="color: #047857; font-weight: 600;">
                                Bundling accessories is highly profitable, adding on average +{{ $money($acc['profit_difference']) }} net profit per device sold.
                            </span>
                        @else
                            <span style="color: #b45309; font-weight: 600;">
                                Free promotional gifts reduced average profit by {{ $money(abs($acc['profit_difference'])) }} per device sold.
                            </span>
                        @endif
                    </td>
                </tr>
            </tfoot>
        </table>
    @endif

    {{-- ═══ 5. SECTION: INVENTORY & ACCOUNTS (for 'all', 'inventory', or 'accounts') ═══ --}}
    @if($sec === 'all')
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
                            <td class="text-right">{{ $stock['owned_units'] ?? 0 }}</td>
                            <td class="text-right">{{ $money($stock['owned_value'] ?? 0) }}</td>
                        </tr>
                        <tr>
                            <td>Vendor consignment in custody</td>
                            <td class="text-right">{{ $stock['vendor_units'] ?? 0 }}</td>
                            <td class="text-right" style="color: #2563eb;">{{ $money($stock['vendor_value'] ?? 0) }}</td>
                        </tr>
                        <tr>
                            <td>Defective / in-repair stock units</td>
                            <td class="text-right">{{ $repairs['reported_count'] ?? 0 }}</td>
                            <td class="text-right" style="color: #d97706;">Repair exp: {{ $money($repairs['repair_expense'] ?? 0) }}</td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr>
                            <td>Total Shelf Stock Holdings</td>
                            <td class="text-right">
                                {{ ($stock['owned_units'] ?? 0) + ($stock['vendor_units'] ?? 0) }}
                            </td>
                            <td class="text-right" style="color: #047857;">
                                {{ $money($stock['owned_value'] ?? 0) }}
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
                    <div class="section-pill">{{ count($cash['accounts'] ?? []) }} accounts</div>
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
                        @php $accounts = array_slice($cash['accounts'] ?? [], 0, 5); @endphp
                        @forelse($accounts as $accItem)
                            <tr>
                                <td style="font-weight: 600;">{{ $accItem['name'] ?? 'Account' }}</td>
                                <td class="text-center" style="font-size: 8.5px; text-transform: uppercase; color: #64748b;">
                                    {{ $accItem['type'] ?? 'bank' }}
                                </td>
                                <td class="text-right" style="color: {{ ($accItem['balance'] ?? 0) >= 0 ? '#0f172a' : '#be123c' }};">
                                    {{ $money($accItem['balance'] ?? 0) }}
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
                                {{ $money($cash['cash_and_bank'] ?? $cash['total_balance'] ?? 0) }}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    @elseif($sec === 'inventory')
        <div class="section-header">
            <div class="section-title">
                <span>Inventory & Stock Valuation Audit</span>
            </div>
            <div class="section-pill">As of {{ $report['period']['to'] ?? 'period end' }}</div>
        </div>

        <table class="report-table">
            <thead>
                <tr>
                    <th style="width: 55%;">Inventory Category / Valuation Area</th>
                    <th class="text-center" style="width: 20%;">Holdings / Metric</th>
                    <th class="text-right" style="width: 25%;">Valuation (at Cost)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="font-weight: 600;">Shop-owned stock on shelf</td>
                    <td class="text-center">{{ $stock['owned_units'] ?? 0 }} devices</td>
                    <td class="text-right" style="font-weight: 700;">{{ $money($stock['owned_value'] ?? 0) }}</td>
                </tr>
                <tr>
                    <td style="font-weight: 600;">Vendor consignment in custody</td>
                    <td class="text-center">{{ $stock['vendor_units'] ?? 0 }} devices</td>
                    <td class="text-right" style="color: #2563eb;">{{ $money($stock['vendor_value'] ?? 0) }}</td>
                </tr>
                <tr>
                    <td>Defective / customer returns reported</td>
                    <td class="text-center">{{ $repairs['reported_count'] ?? 0 }} devices</td>
                    <td class="text-right" style="color: #d97706;">Repair exp: {{ $money($repairs['repair_expense'] ?? 0) }}</td>
                </tr>
                <tr>
                    <td>Total physical shelf inventory count</td>
                    <td class="text-center" style="font-weight: 700;">{{ ($stock['owned_units'] ?? 0) + ($stock['vendor_units'] ?? 0) }} devices</td>
                    <td class="text-right" style="color: #64748b;">Custody total</td>
                </tr>
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="2" style="text-transform: uppercase; font-size: 11px;">
                        Total Shop-Owned Inventory at Cost
                    </td>
                    <td class="text-right" style="font-size: 13px; color: #047857;">
                        {{ $money($stock['owned_value'] ?? 0) }}
                    </td>
                </tr>
            </tfoot>
        </table>
    @elseif($sec === 'accounts')
        <div class="section-header">
            <div class="section-title">
                <span>Accounts & Liquidity Reserves Ledger</span>
            </div>
            <div class="section-pill">{{ count($cash['accounts'] ?? []) }} ledgers</div>
        </div>

        <table class="report-table">
            <thead>
                <tr>
                    <th style="width: 55%;">Financial Account</th>
                    <th class="text-center" style="width: 20%;">Account Type</th>
                    <th class="text-right" style="width: 25%;">Reconciled Balance</th>
                </tr>
            </thead>
            <tbody>
                @php
                    $liquidAccs = array_filter($cash['accounts'] ?? [], fn($a) => empty($a['is_custom_asset']));
                    $customAccs = array_filter($cash['accounts'] ?? [], fn($a) => !empty($a['is_custom_asset']));
                @endphp
                @forelse($liquidAccs as $accItem)
                    <tr>
                        <td style="font-weight: 600;">{{ $accItem['name'] ?? 'Account' }}</td>
                        <td class="text-center" style="font-size: 8.5px; text-transform: uppercase; color: #64748b;">
                            {{ str_replace('_', ' ', $accItem['type'] ?? 'bank') }}
                        </td>
                        <td class="text-right" style="color: {{ ($accItem['balance'] ?? 0) >= 0 ? '#0f172a' : '#be123c' }};">
                            {{ $money($accItem['balance'] ?? 0) }}
                        </td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="3" style="text-align: center; color: #94a3b8; font-style: italic;">No liquid accounts recorded</td>
                    </tr>
                @endforelse

                <tr style="background-color: #f8fafc; font-weight: 700; border-top: 1px solid #cbd5e1;">
                    <td colspan="2">Subtotal Cash & Bank Balances</td>
                    <td class="text-right" style="color: #047857;">{{ $money($cash['cash_and_bank'] ?? $cash['total_balance'] ?? 0) }}</td>
                </tr>

                @if(!empty($customAccs))
                    @foreach($customAccs as $accItem)
                        <tr>
                            <td style="font-weight: 600; color: #92400e;">{{ $accItem['name'] ?? 'Custom Asset' }}</td>
                            <td class="text-center" style="font-size: 8.5px; text-transform: uppercase; color: #b45309;">
                                {{ str_replace('_', ' ', $accItem['type'] ?? 'asset') }}
                            </td>
                            <td class="text-right" style="color: #b45309;">
                                {{ $money($accItem['balance'] ?? 0) }}
                            </td>
                        </tr>
                    @endforeach
                    <tr style="background-color: #fffbeb; font-weight: 700; border-top: 1px solid #fde68a;">
                        <td colspan="2" style="color: #92400e;">Subtotal Custom Business Assets</td>
                        <td class="text-right" style="color: #b45309;">{{ $money($cash['custom_assets'] ?? 0) }}</td>
                    </tr>
                @endif
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="2" style="text-transform: uppercase; font-size: 11px;">
                        Total Account Reserves (Liquid + Custom Assets)
                    </td>
                    <td class="text-right" style="font-size: 13px; color: #047857;">
                        {{ $money($cash['total_liquidity_and_assets'] ?? $cash['cash_and_bank'] ?? $cash['total_balance'] ?? 0) }}
                    </td>
                </tr>
            </tfoot>
        </table>
    @endif

    {{-- ═══ 6. SECTION: FINANCIAL POSITION (for 'position' or ('all' with data)) ═══ --}}
    @if(($sec === 'position' || ($sec === 'all' && !empty($finPos))) && !empty($finPos))
        <div class="section-header">
            <div class="section-title">
                <span>Financial Position & Balance Sheet</span>
            </div>
            <div class="section-pill" style="{{ ($finPos['net_position'] ?? 0) >= 0 ? 'color: #047857; background-color: #ecfdf5;' : 'color: #be123c; background-color: #fff1f2;' }}">
                Net Worth: {{ $money($finPos['net_position'] ?? 0) }}
            </div>
        </div>

        <table class="report-table">
            <thead>
                <tr>
                    <th style="width: 55%;">Balance Sheet Element</th>
                    <th class="text-center" style="width: 20%;">Classification</th>
                    <th class="text-right" style="width: 25%;">Amount (ETB)</th>
                </tr>
            </thead>
            <tbody>
                <!-- Assets -->
                <tr>
                    <td style="font-weight: 600;">Liquid Cash & Bank Balances</td>
                    <td class="text-center" style="font-size: 8.5px; text-transform: uppercase; color: #047857; font-weight: 700;">Asset</td>
                    <td class="text-right" style="color: #047857;">+{{ $money($finPos['assets']['cash_and_bank'] ?? 0) }}</td>
                </tr>
                @if(($finPos['assets']['owned_stock'] ?? 0) > 0)
                    <tr>
                        <td>Owned inventory (at purchase cost)</td>
                        <td class="text-center" style="font-size: 8.5px; text-transform: uppercase; color: #047857; font-weight: 700;">Asset</td>
                        <td class="text-right" style="color: #047857;">+{{ $money($finPos['assets']['owned_stock']) }}</td>
                    </tr>
                @endif
                @if(($finPos['assets']['customer_receivables'] ?? 0) > 0)
                    <tr>
                        <td>Customer receivables owed to shop</td>
                        <td class="text-center" style="font-size: 8.5px; text-transform: uppercase; color: #047857; font-weight: 700;">Asset</td>
                        <td class="text-right" style="color: #047857;">+{{ $money($finPos['assets']['customer_receivables']) }}</td>
                    </tr>
                @endif
                @if(($finPos['assets']['custom_assets'] ?? 0) > 0)
                    <tr>
                        <td>Custom business assets</td>
                        <td class="text-center" style="font-size: 8.5px; text-transform: uppercase; color: #047857; font-weight: 700;">Asset</td>
                        <td class="text-right" style="color: #047857;">+{{ $money($finPos['assets']['custom_assets']) }}</td>
                    </tr>
                @endif
                <tr style="background-color: #f0fdf4; font-weight: 700; border-top: 1px solid #bbf7d0;">
                    <td>Subtotal Owned Assets</td>
                    <td class="text-center" style="font-size: 8.5px; text-transform: uppercase; color: #047857;">Total</td>
                    <td class="text-right" style="color: #047857;">{{ $money($finPos['assets']['total'] ?? 0) }}</td>
                </tr>

                <!-- Liabilities -->
                @forelse($finPos['liabilities']['payables'] ?? [] as $p)
                    <tr>
                        <td>
                            <div style="font-weight: 600;">{{ $p['contact'] ?? 'Payable' }}</div>
                            <div style="font-size: 8.5px; color: #64748b;">
                                {{ $p['reference_type'] === 'customer_return_refund' ? 'Return Refund Due' : ($p['reference_type'] === 'stock_intake' ? 'Supplier Stock Payable' : str_replace('_', ' ', $p['reference_type'] ?? 'payable')) }}
                            </div>
                        </td>
                        <td class="text-center" style="font-size: 8.5px; text-transform: uppercase; color: #be123c; font-weight: 700;">Liability</td>
                        <td class="text-right" style="color: #be123c;">-{{ $money($p['remaining_amount'] ?? 0) }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="3" style="text-align: center; color: #94a3b8; font-style: italic;">No open liabilities or payable debts</td>
                    </tr>
                @endforelse

                <tr style="background-color: #fff1f2; font-weight: 700; border-top: 1px solid #fecdd3;">
                    <td style="color: #be123c;">Subtotal Open Payables & Liabilities</td>
                    <td class="text-center" style="font-size: 8.5px; text-transform: uppercase; color: #be123c;">Total</td>
                    <td class="text-right" style="color: #be123c;">-{{ $money($finPos['liabilities']['open_payables'] ?? 0) }}</td>
                </tr>
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="2" style="text-transform: uppercase; font-size: 11px;">
                        Net Financial Worth (Assets − Liabilities)
                    </td>
                    <td class="text-right" style="font-size: 13px; color: {{ ($finPos['net_position'] ?? 0) >= 0 ? '#047857' : '#be123c' }};">
                        {{ $money($finPos['net_position'] ?? 0) }}
                    </td>
                </tr>
            </tfoot>
        </table>
    @endif

    {{-- ═══ 7. SECTION: BALANCE RECONCILIATION & AUDIT VERIFICATION ═══ --}}
    @if(($sec === 'reconciliation' || ($sec === 'all' && !empty($rec))) && !empty($rec))
        @php
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
                        <th style="width: 50%;">Audit Flow Milestone / Flow Item</th>
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
                    @if(($rec['other_income'] ?? 0) > 0)
                        <tr>
                            <td>(+) Other direct operating income</td>
                            <td class="text-right" style="color: #047857;">+{{ $money($rec['other_income']) }}</td>
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
                    @if(($rec['loan_disbursements'] ?? 0) > 0)
                        <tr>
                            <td>(-) Loan disbursements & extended customer credit</td>
                            <td class="text-right" style="color: #be123c;">-{{ $money($rec['loan_disbursements']) }}</td>
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

    {{-- ═══ 8. SECTION: STAFF & VENDORS (for 'all', 'staff', or 'vendors') ═══ --}}
    @if($sec === 'all')
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
    @elseif($sec === 'staff')
        <div class="section-header">
            <div class="section-title">
                <span>Staff Sales Performance Audit</span>
            </div>
            <div class="section-pill">{{ count($report['staff_performance'] ?? []) }} sellers</div>
        </div>

        <table class="report-table">
            <thead>
                <tr>
                    <th style="width: 40%;">Salesperson</th>
                    <th class="text-center" style="width: 12%;">Orders</th>
                    <th class="text-center" style="width: 12%;">Units Sold</th>
                    <th class="text-right" style="width: 18%;">Sales Revenue</th>
                    <th class="text-right" style="width: 18%;">Realized Profit</th>
                </tr>
            </thead>
            <tbody>
                @forelse($report['staff_performance'] ?? [] as $staff)
                    <tr>
                        <td style="font-weight: 600;">{{ $staff['name'] ?? 'Staff' }}</td>
                        <td class="text-center">{{ $staff['orders'] ?? 0 }}</td>
                        <td class="text-center">{{ $staff['units'] ?? 0 }}</td>
                        <td class="text-right">{{ $money($staff['revenue'] ?? 0) }}</td>
                        <td class="text-right" style="color: #047857; font-weight: 700;">{{ $money($staff['profit'] ?? 0) }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="5" style="text-align: center; color: #94a3b8; font-style: italic; padding: 16px;">
                            No staff sales performance records in this audit period.
                        </td>
                    </tr>
                @endforelse
            </tbody>
            <tfoot>
                <tr>
                    <td style="text-transform: uppercase; font-size: 11px;">Total Staff Sales Production</td>
                    <td class="text-center">{{ $staffTotals['orders'] ?? 0 }}</td>
                    <td class="text-center">{{ $staffTotals['units'] ?? 0 }}</td>
                    <td class="text-right">{{ $money($staffTotals['revenue'] ?? 0) }}</td>
                    <td class="text-right" style="font-size: 12px; color: #047857;">{{ $money($staffTotals['profit'] ?? 0) }}</td>
                </tr>
            </tfoot>
        </table>
    @elseif($sec === 'vendors')
        <div class="section-header">
            <div class="section-title">
                <span>Vendor Consignment Activity Audit</span>
            </div>
            <div class="section-pill">{{ count($report['vendor_activity']['vendors'] ?? []) }} vendors</div>
        </div>

        <table class="report-table">
            <thead>
                <tr>
                    <th style="width: 40%;">Vendor Partner / Supplier</th>
                    <th class="text-center" style="width: 15%;">Inflow Received</th>
                    <th class="text-center" style="width: 15%;">Returned</th>
                    <th class="text-center" style="width: 15%;">Units Sold</th>
                    <th class="text-right" style="width: 15%;">Realized Sales</th>
                </tr>
            </thead>
            <tbody>
                @forelse($report['vendor_activity']['vendors'] ?? [] as $vnd)
                    <tr>
                        <td style="font-weight: 600;">{{ $vnd['name'] ?? 'Partner' }}</td>
                        <td class="text-center">{{ $vnd['received_units'] ?? 0 }}</td>
                        <td class="text-center" style="color: #be123c;">{{ $vnd['returned_units'] ?? 0 }}</td>
                        <td class="text-center" style="color: #047857; font-weight: 700;">{{ $vnd['units_sold'] ?? 0 }}</td>
                        <td class="text-right">{{ $money($vnd['revenue'] ?? 0) }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="5" style="text-align: center; color: #94a3b8; font-style: italic; padding: 16px;">
                            No vendor consignment activity recorded in this audit period.
                        </td>
                    </tr>
                @endforelse
            </tbody>
            <tfoot>
                <tr>
                    <td style="text-transform: uppercase; font-size: 11px;">Total Consignment Movement</td>
                    <td class="text-center">{{ $vendorTotals['received'] ?? 0 }}</td>
                    <td class="text-center" style="color: #be123c;">{{ $vendorTotals['returned'] ?? 0 }}</td>
                    <td class="text-center" style="color: #047857;">{{ $vendorTotals['sold'] ?? 0 }}</td>
                    <td class="text-right" style="font-size: 12px;">{{ $money($vendorTotals['revenue'] ?? 0) }}</td>
                </tr>
            </tfoot>
        </table>
    @endif

    {{-- ═══ 9. SECTION: REPAIR & MAINTENANCE ═══ --}}
    @if($sec === 'repairs' || ($sec === 'all' && (($repairs['reported_count'] ?? 0) > 0 || ($repairs['repaired_count'] ?? 0) > 0)))
        <div class="section-header">
            <div class="section-title">
                <span>Repair & Maintenance Report</span>
            </div>
            <div class="section-pill">{{ $report['period']['label'] ?? 'All Records' }}</div>
        </div>

        <table class="report-table">
            <thead>
                <tr>
                    <th style="width: 70%;">Maintenance Area / Diagnostic Metric</th>
                    <th class="text-right" style="width: 30%;">Result</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Defects & customer returns reported in period</td>
                    <td class="text-right font-mono">{{ $repairs['reported_count'] ?? 0 }} units</td>
                </tr>
                <tr>
                    <td>Serviced repair jobs successfully completed</td>
                    <td class="text-right font-mono" style="color: #047857; font-weight: 700;">{{ $repairs['repaired_count'] ?? 0 }} units</td>
                </tr>
                <tr>
                    <td>Resolution fulfillment rate</td>
                    <td class="text-right font-mono">
                        {{ ($repairs['reported_count'] ?? 0) > 0 ? round((($repairs['repaired_count'] ?? 0) / $repairs['reported_count']) * 100) . '%' : '100% (No defects)' }}
                    </td>
                </tr>
            </tbody>
            <tfoot>
                <tr>
                    <td style="text-transform: uppercase; font-size: 11px;">Total Repair Expenditure</td>
                    <td class="text-right" style="font-size: 13px; color: #be123c;">
                        {{ $money($repairs['repair_expense'] ?? 0) }}
                    </td>
                </tr>
            </tfoot>
        </table>
    @endif

    <!-- ═══ 10. OFFICIAL CORPORATE SIGN-OFF & VERIFICATION ═══ -->
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
                <span>Audit Ref: #{{ strtoupper(substr(md5($from . $to . $sec), 0, 8)) }}</span>
            </div>
        </div>
    </div>

    <div class="audit-footer-note">
        This document represents an official accounting and business audit generated from verified ledger transactions.
        Confidential and proprietary to {{ $business['name'] }}.
    </div>
</body>
</html>
