@php
    $status = $receivable->status;
    $statusText = 'Belum Lunas';
    $statusBg = '#fef3c7';
    $statusColor = '#b45309';
    $statusBorder = '#fde68a';

    if ($status === 'paid' || (float) ($receivable->remaining ?? ($receivable->total - $receivable->paid)) <= 0) {
        $statusText = 'Lunas';
        $statusBg = '#dcfce7';
        $statusColor = '#15803d';
        $statusBorder = '#bbf7d0';
    } elseif ($status === 'partial') {
        $statusText = 'Parsial';
        $statusBg = '#e0e7ff';
        $statusColor = '#4338ca';
        $statusBorder = '#c7d2fe';
    } elseif ($status === 'overdue') {
        $statusText = 'Jatuh Tempo';
        $statusBg = '#ffe4e6';
        $statusColor = '#be123c';
        $statusBorder = '#fecdd3';
    }
@endphp
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Piutang {{ $receivable->invoice }}</title>
    <style>
        @page {
            margin: 8mm 10mm;
            size: a5 portrait;
        }
        * {
            box-sizing: border-box;
        }
        body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #0f172a;
            font-size: 11px;
            line-height: 1.35;
        }
        .container {
            width: 100%;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 14px 16px;
            background: #ffffff;
        }
        .header-table {
            width: 100%;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 10px;
            margin-bottom: 10px;
            border-collapse: collapse;
        }
        .store-name {
            font-weight: 800;
            font-size: 15px;
            color: #0f172a;
        }
        .muted {
            color: #64748b;
            font-size: 10px;
        }
        .doc-title {
            font-size: 10px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 600;
        }
        .doc-number {
            font-size: 15px;
            font-weight: 800;
            color: #0f172a;
            margin: 1px 0;
        }
        .badge {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 999px;
            font-weight: 700;
            font-size: 10.5px;
            text-align: center;
        }
        .sub-header-table {
            width: 100%;
            margin-bottom: 10px;
            border-collapse: collapse;
        }
        .section-label {
            font-size: 10px;
            color: #64748b;
            text-transform: uppercase;
            font-weight: 600;
            margin-bottom: 2px;
        }
        .customer-name {
            font-size: 13px;
            font-weight: 700;
            color: #0f172a;
        }
        .stats-table {
            width: 100%;
            margin-bottom: 12px;
            border-collapse: separate;
            border-spacing: 6px 0;
        }
        .stat-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 8px 10px;
            text-align: left;
            vertical-align: top;
        }
        .stat-card-warning {
            background: #fffbeb;
            border: 1px solid #fef3c7;
        }
        .stat-label {
            font-size: 9.5px;
            color: #64748b;
            text-transform: uppercase;
            font-weight: 600;
            letter-spacing: 0.3px;
        }
        .stat-value {
            font-size: 14px;
            font-weight: 800;
            color: #0f172a;
            margin-top: 2px;
        }
        .stat-paid {
            color: #16a34a;
        }
        .stat-remaining {
            color: #d97706;
        }
        .table-title {
            font-size: 11px;
            font-weight: 700;
            color: #334155;
            margin-bottom: 6px;
        }
        .payment-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            overflow: hidden;
            margin-bottom: 10px;
        }
        .payment-table th {
            background: #f8fafc;
            color: #475569;
            font-size: 9.5px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            padding: 6px 8px;
            border-bottom: 1px solid #e2e8f0;
            text-align: left;
        }
        .payment-table td {
            padding: 6px 8px;
            font-size: 10.5px;
            border-bottom: 1px solid #f1f5f9;
            color: #1e293b;
        }
        .payment-table tr:last-child td {
            border-bottom: none;
        }
        .footer-table {
            width: 100%;
            border-top: 1px solid #e2e8f0;
            padding-top: 8px;
            margin-top: 6px;
            border-collapse: collapse;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <table class="header-table">
            <tr>
                <td style="width: 52px; vertical-align: top;">
                    @if(!empty($store['logo_data']))
                        <img src="{{ $store['logo_data'] }}" alt="{{ $store['name'] }}" style="max-height: 44px; max-width: 44px; object-fit: contain;">
                    @elseif(!empty($store['logo']))
                        <img src="{{ $store['logo'] }}" alt="{{ $store['name'] }}" style="max-height: 44px; max-width: 44px; object-fit: contain;">
                    @else
                        <div style="width: 40px; height: 40px; background: #e0e7ff; color: #4338ca; font-weight: 800; font-size: 15px; text-align: center; line-height: 40px; border-radius: 6px;">
                            {{ substr($store['name'] ?? 'POS', 0, 2) }}
                        </div>
                    @endif
                </td>
                <td style="vertical-align: top; padding-left: 6px;">
                    <div class="store-name">{{ $store['name'] }}</div>
                    @if($store['address'])
                        <div class="muted">{{ $store['address'] }}</div>
                    @endif
                    <div class="muted">
                        {{ $store['phone'] ? 'Telp: ' . $store['phone'] : '' }}
                        {{ $store['phone'] && $store['email'] ? ' • ' : '' }}
                        {{ $store['email'] ?? '' }}
                    </div>
                </td>
                <td style="vertical-align: top; text-align: right;">
                    <div class="doc-title">Dokumen</div>
                    <div class="doc-number">{{ $receivable->invoice }}</div>
                    <div class="muted">Jatuh tempo: {{ $receivable->due_date ? \Carbon\Carbon::parse($receivable->due_date)->format('d M Y') : '-' }}</div>
                </td>
            </tr>
        </table>

        <!-- Subheader: Pelanggan & Status -->
        <table class="sub-header-table">
            <tr>
                <td style="vertical-align: top; width: 60%;">
                    <div class="section-label">Pelanggan</div>
                    <div class="customer-name">{{ $receivable->customer->name ?? 'Pelanggan Umum' }}</div>
                    @if($receivable->customer?->phone)
                        <div class="muted">{{ $receivable->customer->phone }}</div>
                    @endif
                </td>
                <td style="vertical-align: top; text-align: right; width: 40%;">
                    <div class="section-label">Status</div>
                    <div style="margin-top: 3px;">
                        <span class="badge" style="background: {{ $statusBg }}; color: {{ $statusColor }}; border: 1px solid {{ $statusBorder }};">
                            {{ $statusText }}
                        </span>
                    </div>
                </td>
            </tr>
        </table>

        <!-- Stat Cards -->
        <table class="stats-table">
            <tr>
                <td class="stat-card" style="width: 33.33%;">
                    <div class="stat-label">Total Piutang</div>
                    <div class="stat-value">Rp {{ number_format($receivable->total, 0, ',', '.') }}</div>
                </td>
                <td class="stat-card" style="width: 33.33%;">
                    <div class="stat-label">Terbayar</div>
                    <div class="stat-value stat-paid">Rp {{ number_format($receivable->paid, 0, ',', '.') }}</div>
                </td>
                <td class="stat-card stat-card-warning" style="width: 33.33%;">
                    <div class="stat-label" style="color: #b45309;">Sisa Tagihan</div>
                    <div class="stat-value stat-remaining">Rp {{ number_format(max(0, $receivable->total - $receivable->paid), 0, ',', '.') }}</div>
                </td>
            </tr>
        </table>

        <!-- Riwayat Pembayaran -->
        <div class="table-title">Riwayat Pembayaran</div>
        <table class="payment-table">
            <thead>
                <tr>
                    <th style="width: 25%;">Tanggal</th>
                    <th style="width: 25%;">Metode</th>
                    <th style="width: 25%;">Pencatat</th>
                    <th style="width: 25%; text-align: right;">Jumlah</th>
                </tr>
            </thead>
            <tbody>
                @forelse($receivable->payments as $pay)
                    <tr>
                        <td>{{ \Carbon\Carbon::parse($pay->paid_at)->format('d M Y') }}</td>
                        <td>
                            {{ strtoupper($pay->method ?? '-') }}
                            @if($pay->bankAccount)
                                <div class="muted">{{ $pay->bankAccount->bank_name }}</div>
                            @endif
                        </td>
                        <td>{{ $pay->user->name ?? '-' }}</td>
                        <td style="text-align: right; font-weight: 700;">Rp {{ number_format($pay->amount, 0, ',', '.') }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="4" style="text-align: center; color: #94a3b8; padding: 12px 0;">Belum ada riwayat pembayaran</td>
                    </tr>
                @endforelse
            </tbody>
        </table>

        <!-- Footer -->
        <table class="footer-table">
            <tr>
                <td style="vertical-align: middle;">
                    <div class="muted">Dicetak pada: {{ now()->translatedFormat('d F Y H:i') }}</div>
                </td>
                <td style="vertical-align: middle; text-align: right;">
                    @if(!empty($barcode))
                        <img src="{{ $barcode }}" alt="barcode" style="height: 30px;">
                        <div class="muted" style="font-size: 8.5px; margin-top: 1px;">{{ $receivable->invoice }}</div>
                    @endif
                </td>
            </tr>
        </table>
    </div>
</body>
</html>
