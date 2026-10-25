<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{{ $filename ?? 'Staff Statement' }}</title>
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
            font-size: 8.5pt;
            line-height: 1.4;
            color: #0f172a;
            background-color: #ffffff;
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
            max-height: 55px;
            max-width: 160px;
            object-fit: contain;
            border-radius: 6px;
        }

        .brand-logo-fallback {
            width: 45px;
            height: 45px;
            background-color: #0f172a;
            color: #ffffff;
            border-radius: 8px;
            display: block;
            text-align: center;
            line-height: 45px;
            font-size: 15pt;
            font-weight: 800;
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
            font-size: 10.5pt;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #0f172a;
        }

        .doc-range {
            font-size: 8pt;
            font-weight: 600;
            color: #475569;
            margin-top: 2px;
        }

        .doc-issued {
            font-size: 7pt;
            color: #94a3b8;
            margin-top: 2px;
        }

        /* ─── Staff Position Strip ─── */
        .position-strip {
            display: table;
            width: 100%;
            table-layout: fixed;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 9px 12px;
            margin-bottom: 12px;
        }

        .staff-info {
            display: table-cell;
            vertical-align: middle;
            width: 55%;
        }

        .staff-label {
            font-size: 6.5pt;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #94a3b8;
            display: block;
            margin-bottom: 2px;
        }

        .staff-name {
            font-size: 12pt;
            font-weight: 800;
            color: #0f172a;
            line-height: 1.2;
            margin-bottom: 2px;
        }

        .staff-meta {
            font-size: 7.5pt;
            color: #475569;
            display: block;
        }

        .role-tag {
            font-size: 6pt;
            font-weight: 700;
            text-transform: uppercase;
            padding: 2px 5px;
            border-radius: 4px;
            background-color: #e0e7ff;
            color: #3730a3;
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

        .balance-label {
            font-size: 6.5pt;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #047857;
        }

        .balance-amount {
            font-size: 15pt;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.3px;
        }

        .currency-tag {
            font-size: 8pt;
            font-weight: 600;
            color: #94a3b8;
            margin-left: 3px;
        }

        /* ─── Bento Summary Grid ─── */
        .bento-grid {
            display: table;
            width: 100%;
            table-layout: fixed;
            margin-bottom: 12px;
        }

        .bento-cell {
            display: table-cell;
            vertical-align: top;
            padding: 7px 9px;
            background-color: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
        }

        .bento-cell + .bento-cell {
            margin-left: 6px;
        }

        .bento-title {
            font-size: 6.5pt;
            font-weight: 700;
            text-transform: uppercase;
            color: #64748b;
            letter-spacing: 0.4px;
        }

        .bento-value {
            font-size: 10.5pt;
            font-weight: 800;
            color: #0f172a;
            margin-top: 2px;
        }

        /* ─── Section Headers & Tables ─── */
        .section-header {
            font-size: 8.5pt;
            font-weight: 800;
            text-transform: uppercase;
            color: #0f172a;
            letter-spacing: 0.5px;
            margin-top: 10px;
            margin-bottom: 5px;
            padding-bottom: 3px;
            border-bottom: 1.5px solid #0f172a;
            display: flex;
            justify-content: space-between;
        }

        .table-data {
            width: 100%;
            border-collapse: collapse;
            font-size: 7.5pt;
            margin-bottom: 10px;
        }

        .table-data th {
            background-color: #f1f5f9;
            color: #334155;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 6.5pt;
            padding: 5px 6px;
            border-bottom: 1px solid #cbd5e1;
            text-align: left;
        }

        .table-data td {
            padding: 5px 6px;
            border-bottom: 1px solid #f1f5f9;
            color: #1e293b;
        }

        .table-data tr:nth-child(even) td {
            background-color: #f8fafc;
        }

        .badge-bonus {
            display: inline-block;
            font-size: 6pt;
            font-weight: 800;
            text-transform: uppercase;
            padding: 1.5px 4.5px;
            border-radius: 3px;
            background-color: #dcfce7;
            color: #15803d;
            border: 0.5px solid #86efac;
        }

        .badge-settled {
            display: inline-block;
            font-size: 6pt;
            font-weight: 700;
            text-transform: uppercase;
            padding: 1.5px 4.5px;
            border-radius: 3px;
            background-color: #f1f5f9;
            color: #475569;
        }

        .badge-custody {
            display: inline-block;
            font-size: 6pt;
            font-weight: 800;
            text-transform: uppercase;
            padding: 1.5px 4.5px;
            border-radius: 3px;
            background-color: #fef3c7;
            color: #b45309;
            border: 0.5px solid #fde68a;
        }

        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        .font-bold { font-weight: 700; }

        /* ─── Stamp & Signature ─── */
        .auth-footer {
            margin-top: 18px;
            display: table;
            width: 100%;
            table-layout: fixed;
            page-break-inside: avoid;
        }

        .auth-cell {
            display: table-cell;
            vertical-align: bottom;
            width: 50%;
            text-align: center;
            padding: 0 10px;
        }

        .sig-line {
            border-top: 1px dashed #94a3b8;
            margin-top: 35px;
            padding-top: 4px;
            font-size: 7.5pt;
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
        }

        .stamp-box {
            max-height: 55px;
            max-width: 90px;
            object-fit: contain;
            margin: 0 auto -20px auto;
            display: block;
        }
    </style>
</head>
<body>

    <!-- Letterhead -->
    <div class="letterhead">
        <div class="brand-section">
            <table class="brand-layout-table">
                <tr>
                    @if (!empty($business['logo_base64']))
                        <td style="padding-right: 10px;">
                            <img src="{{ $business['logo_base64'] }}" alt="Logo" class="brand-logo" />
                        </td>
                    @else
                        <td style="padding-right: 10px;">
                            <div class="brand-logo-fallback">{{ substr($business['name'] ?? 'B', 0, 1) }}</div>
                        </td>
                    @endif
                    <td>
                        <h1 class="company-name">{{ $business['name'] ?? 'Electronics Store' }}</h1>
                        <span class="company-meta">
                            {{ $business['address'] ?? 'Bole, Addis Ababa, Ethiopia' }}<br>
                            Tel: {{ $business['phone'] ?? '+251 900 000000' }} · Email: {{ $business['email'] ?? 'info@store.et' }}
                        </span>
                    </td>
                </tr>
            </table>
        </div>

        <div class="doc-title-section">
            <span class="doc-badge">Staff Performance &amp; Commission Statement</span>
            <div class="doc-range">Period: {{ $range }}</div>
            <div class="doc-issued">Generated: {{ $generated_at }}</div>
        </div>
    </div>

    <!-- Staff Position Strip -->
    <div class="position-strip">
        <div class="staff-info">
            <span class="staff-label">Staff Member Details</span>
            <div class="staff-name">
                {{ $staff->name }}
                <span class="role-tag">{{ ucfirst($staff->role) }}</span>
            </div>
            <span class="staff-meta font-mono">
                Phone: {{ $staff->phone ?? '—' }} · Email: {{ $staff->email }}
            </span>
        </div>

        <div class="balance-box">
            <span class="balance-label">● Net Bonus Payable (Owed to Staff)</span>
            <div class="balance-amount font-mono">
                {{ number_format($summary['uncollected_bonus'] ?? 0, 2) }}
                <span class="currency-tag">ETB</span>
            </div>
        </div>
    </div>

    <!-- Bento Summary Grid -->
    <div class="bento-grid">
        <div class="bento-cell" style="width: 20%;">
            <div class="bento-title">Total Bonus Earned</div>
            <div class="bento-value font-mono">{{ number_format($summary['total_bonus_earned'] ?? 0, 2) }} ETB</div>
        </div>
        <div class="bento-cell" style="width: 20%;">
            <div class="bento-title">Total Bonus Paid</div>
            <div class="bento-value font-mono" style="color: #059669;">{{ number_format($summary['collected_bonus'] ?? 0, 2) }} ETB</div>
        </div>
        <div class="bento-cell" style="width: 20%;">
            <div class="bento-title">Net Unsettled Bonus</div>
            <div class="bento-value font-mono" style="color: #b45309;">{{ number_format($summary['uncollected_bonus'] ?? 0, 2) }} ETB</div>
        </div>
        <div class="bento-cell" style="width: 20%;">
            <div class="bento-title">Sales Volume Closed</div>
            <div class="bento-value font-mono">{{ number_format($summary['total_sales_volume'] ?? 0, 0) }} ETB</div>
        </div>
        <div class="bento-cell" style="width: 20%;">
            <div class="bento-title">Devices in Custody</div>
            <div class="bento-value font-mono">{{ $summary['active_handovers_count'] ?? 0 }} units</div>
        </div>
    </div>

    <!-- Section 1: Commission & Bonus Ledger -->
    <div class="section-header">
        <span>1. Sales Commission &amp; Bonus Ledger (Protected Commissions)</span>
        <span style="font-weight: 500; font-size: 7pt; color: #64748b;">All bonuses earned &amp; disbursed</span>
    </div>

    <table class="table-data">
        <thead>
            <tr>
                <th style="width: 14%;">Date</th>
                <th style="width: 16%;">Order / Ref #</th>
                <th style="width: 32%;">Description</th>
                <th style="width: 10%;" class="text-center">Flag</th>
                <th style="width: 14%;" class="text-right">Bonus Amount</th>
                <th style="width: 14%;" class="text-right">Remaining</th>
            </tr>
        </thead>
        <tbody>
            @forelse ($bonus_debts as $debt)
                <tr>
                    <td>{{ $debt->created_at ? $debt->created_at->format('M d, Y') : '—' }}</td>
                    <td class="font-mono font-bold">{{ $debt->salesOrder?->order_number ?? 'Order' }}</td>
                    <td>
                        {{ $debt->notes ?: 'Sales commission bonus' }}
                    </td>
                    <td class="text-center">
                        @if ($debt->status === 'settled' || (float) $debt->remaining_amount <= 0)
                            <span class="badge-settled">Paid</span>
                        @else
                            <span class="badge-bonus">Bonus</span>
                        @endif
                    </td>
                    <td class="text-right font-mono font-bold">{{ number_format($debt->original_amount, 2) }}</td>
                    <td class="text-right font-mono font-bold" style="{{ (float) $debt->remaining_amount > 0 ? 'color: #b45309;' : 'color: #64748b;' }}">
                        {{ number_format($debt->remaining_amount, 2) }}
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="6" class="text-center" style="padding: 12px; color: #94a3b8;">
                        No commission bonuses recorded for this staff member in this period.
                    </td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <!-- Section 2: Sales Closed Record -->
    @if (!empty($sales_orders) && count($sales_orders) > 0)
        <div class="section-header">
            <span>2. Sales Orders Closed ({{ count($sales_orders) }} orders)</span>
            <span style="font-weight: 500; font-size: 7pt; color: #64748b;">Direct sales production</span>
        </div>

        <table class="table-data">
            <thead>
                <tr>
                    <th style="width: 14%;">Date</th>
                    <th style="width: 18%;">Order Number</th>
                    <th style="width: 26%;">Customer</th>
                    <th style="width: 14%;" class="text-center">Status</th>
                    <th style="width: 14%;" class="text-right">Order Total</th>
                    <th style="width: 14%;" class="text-right">Bonus Awarded</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($sales_orders->take(15) as $order)
                    <tr>
                        <td>{{ $order->order_date ? \Carbon\Carbon::parse($order->order_date)->format('M d, Y') : $order->created_at->format('M d, Y') }}</td>
                        <td class="font-mono font-bold">{{ $order->order_number }}</td>
                        <td>{{ $order->customer?->name ?? 'Walk-in Customer' }}</td>
                        <td class="text-center font-bold" style="text-transform: uppercase; font-size: 6.5pt; color: {{ $order->payment_status === 'paid' ? '#047857' : '#b45309' }};">
                            {{ $order->payment_status }}
                        </td>
                        <td class="text-right font-mono">{{ number_format($order->total_amount, 2) }}</td>
                        <td class="text-right font-mono font-bold" style="color: #059669;">{{ number_format($order->total_bonus_amount ?? 0, 2) }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif

    <!-- Section 3: Devices in Custody & Handouts -->
    @if (!empty($handovers) && count($handovers) > 0)
        <div class="section-header">
            <span>3. Inventory Devices in Custody ({{ count($handovers) }} units tracked)</span>
            <span style="font-weight: 500; font-size: 7pt; color: #64748b;">Temporary custody items</span>
        </div>

        <table class="table-data">
            <thead>
                <tr>
                    <th style="width: 15%;">Handout Date</th>
                    <th style="width: 30%;">Device &amp; Model</th>
                    <th style="width: 25%;">SN / IMEI</th>
                    <th style="width: 15%;" class="text-center">Custody Status</th>
                    <th style="width: 15%;" class="text-right">Device Value</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($handovers->take(10) as $unit)
                    <tr>
                        <td>{{ $unit->handed_out_at ? \Carbon\Carbon::parse($unit->handed_out_at)->format('M d, Y') : '—' }}</td>
                        <td class="font-bold">{{ $unit->variant?->product?->name ?? 'Device' }}</td>
                        <td class="font-mono">{{ $unit->imei_or_serial ?? '—' }}</td>
                        <td class="text-center">
                            @if ($unit->status === 'out')
                                <span class="badge-custody">In Hand</span>
                            @elseif ($unit->status === 'sold')
                                <span class="badge-settled">Sold</span>
                            @else
                                <span class="badge-settled">{{ ucfirst($unit->status) }}</span>
                            @endif
                        </td>
                        <td class="text-right font-mono">{{ number_format($unit->handover_payout ?: ($unit->selling_price ?: $unit->cost_basis), 2) }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif

    <!-- Authentication Footer -->
    <div class="auth-footer">
        <div class="auth-cell">
            <div class="sig-line">Staff Member Signature</div>
            <div style="font-size: 6.5pt; color: #94a3b8; margin-top: 2px;">Acknowledged: {{ $staff->name }}</div>
        </div>

        <div class="auth-cell">
            @if (!empty($stampBase64))
                <img src="{{ $stampBase64 }}" alt="Stamp" class="stamp-box" />
            @endif
            @if (!empty($signatureBase64))
                <img src="{{ $signatureBase64 }}" alt="Signature" style="max-height: 35px; max-width: 90px; margin: 0 auto -10px auto; display: block;" />
            @endif
            <div class="sig-line">Store Owner Authorized Sign &amp; Stamp</div>
            <div style="font-size: 6.5pt; color: #94a3b8; margin-top: 2px;">{{ $business['name'] ?? 'Authorized Business Management' }}</div>
        </div>
    </div>

</body>
</html>