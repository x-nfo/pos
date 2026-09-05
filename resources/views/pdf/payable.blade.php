@php
    $status = $payable->status;
    $statusText = 'Belum Lunas';
    $statusBg = '#fef3c7';
    $statusColor = '#b45309';
    $statusBorder = '#fde68a';

    if ($status === 'paid' || (float) ($payable->remaining ?? ($payable->total - $payable->paid)) <= 0) {
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
    <title>Hutang {{ $payable->document_number }}</title>
    <style>
        @page {
            margin: 15mm 18mm;
            size: a4 portrait;
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
            line-height: 1.4;
        }
        .w-full {
            width: 100%;
        }
        .header-table {
            width: 100%;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 14px;
            border-collapse: collapse;
        }
        .store-name {
            font-weight: 800;
            font-size: 16px;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: -0.3px;
        }
        .muted {
            color: #64748b;
            font-size: 10.5px;
            line-height: 1.35;
        }
        .doc-title {
            font-size: 18px;
            font-weight: 900;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: -0.5px;
            line-height: 1.1;
        }
        .doc-number {
            font-size: 15px;
            font-weight: 800;
            color: #2563eb;
            margin-top: 2px;
            margin-bottom: 3px;
        }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 999px;
            font-weight: 700;
            font-size: 11px;
            text-align: center;
            letter-spacing: 0.3px;
        }
        .sub-header-table {
            width: 100%;
            margin-bottom: 14px;
            border-collapse: collapse;
        }
        .section-label {
            font-size: 10px;
            color: #64748b;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.4px;
            margin-bottom: 3px;
        }
        .supplier-name {
            font-size: 14px;
            font-weight: 800;
            color: #0f172a;
        }
        .stats-table {
            width: 100%;
            margin-bottom: 16px;
            border-collapse: collapse;
        }
        .stat-card-inner {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 14px;
            text-align: left;
        }
        .stat-card-paid {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
        }
        .stat-card-warning {
            background: #fffbeb;
            border: 1px solid #fde68a;
        }
        .stat-label {
            font-size: 10px;
            color: #64748b;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.4px;
        }
        .stat-value {
            font-size: 16px;
            font-weight: 800;
            color: #0f172a;
            margin-top: 3px;
        }
        .stat-paid-val {
            color: #16a34a;
        }
        .stat-remaining-val {
            color: #d97706;
        }
        .table-title {
            font-size: 11px;
            font-weight: 700;
            color: #334155;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            margin-bottom: 8px;
        }
        .payment-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            overflow: hidden;
            margin-bottom: 14px;
        }
        .payment-table th {
            background: #f8fafc;
            color: #475569;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            padding: 8px 10px;
            border-bottom: 1px solid #e2e8f0;
            text-align: left;
        }
        .payment-table td {
            padding: 8px 10px;
            font-size: 11px;
            border-bottom: 1px solid #f1f5f9;
            color: #1e293b;
        }
        .payment-table tr:last-child td {
            border-bottom: none;
        }
        .footer-table {
            width: 100%;
            border-top: 1px solid #e2e8f0;
            padding-top: 10px;
            margin-top: 16px;
            border-collapse: collapse;
        }
    </style>
</head>
<body>
    <!-- Header -->
    <table class="header-table">
        <tr>
            <td style="width: 54px; vertical-align: top; padding-right: 10px;">
                @if(!empty($store['logo_data']))
                    <img src="{{ $store['logo_data'] }}" alt="{{ $store['name'] }}" style="max-height: 48px; max-width: 48px; object-fit: contain;">
                @elseif(!empty($store['logo']))
                    <img src="{{ $store['logo'] }}" alt="{{ $store['name'] }}" style="max-height: 48px; max-width: 48px; object-fit: contain;">
                @else
                    <div style="width: 46px; height: 46px; background: #e0e7ff; color: #4338ca; font-weight: 800; font-size: 16px; text-align: center; line-height: 46px; border-radius: 8px;">
                        {{ substr($store['name'] ?? 'POS', 0, 2) }}
                    </div>
                @endif
            </td>
            <td style="vertical-align: top;">
                <div class="store-name">{{ $store['name'] ?? 'POS' }}</div>
                @if(!empty($store['address']))
                    <div class="muted">{{ $store['address'] }}</div>
                @endif
                <div class="muted">
                    {{ !empty($store['phone']) ? 'Telp: ' . $store['phone'] : '' }}
                    {{ !empty($store['phone']) && !empty($store['email']) ? ' • ' : '' }}
                    {{ $store['email'] ?? '' }}
                </div>
            </td>
            <td style="vertical-align: top; text-align: right; width: 220px;">
                <div class="doc-title">Dokumen Hutang</div>
                <div class="doc-number">{{ $payable->document_number }}</div>
                @if($payable->vendor_invoice_number)
                    <div class="muted">Faktur Supplier: <strong>{{ $payable->vendor_invoice_number }}</strong></div>
                @endif
                <div class="muted">Jatuh Tempo: <strong>{{ $payable->due_date ? \Carbon\Carbon::parse($payable->due_date)->format('d M Y') : '-' }}</strong></div>
            </td>
        </tr>
    </table>

    <!-- Subheader: Supplier & Status -->
    <table class="sub-header-table">
        <tr>
            <td style="vertical-align: top; width: 65%;">
                <div class="section-label">Supplier</div>
                <div class="supplier-name">{{ $payable->supplier->name ?? '-' }}</div>
                @if($payable->supplier?->phone)
                    <div class="muted">Telp: {{ $payable->supplier->phone }}</div>
                @endif
                @if($payable->supplier?->address)
                    <div class="muted">{{ $payable->supplier->address }}</div>
                @endif
            </td>
            <td style="vertical-align: top; text-align: right; width: 35%;">
                <div class="section-label">Status Pembayaran</div>
                <div style="margin-top: 4px;">
                    <span class="badge" style="background: {{ $statusBg }}; color: {{ $statusColor }}; border: 1px solid {{ $statusBorder }};">
                        {{ $statusText }}
                    </span>
                </div>
            </td>
        </tr>
    </table>

    <!-- Stat Cards (Ringkasan Tagihan) -->
    <table class="stats-table">
        <tr>
            <td style="width: 33.33%; padding-right: 6px; vertical-align: top;">
                <div class="stat-card-inner">
                    <div class="stat-label">Total Hutang</div>
                    <div class="stat-value">Rp {{ number_format($payable->total, 0, ',', '.') }}</div>
                </div>
            </td>
            <td style="width: 33.33%; padding: 0 4px; vertical-align: top;">
                <div class="stat-card-inner stat-card-paid">
                    <div class="stat-label" style="color: #15803d;">Terbayar</div>
                    <div class="stat-value stat-paid-val">Rp {{ number_format($payable->paid, 0, ',', '.') }}</div>
                </div>
            </td>
            <td style="width: 33.33%; padding-left: 6px; vertical-align: top;">
                <div class="stat-card-inner stat-card-warning">
                    <div class="stat-label" style="color: #b45309;">Sisa Tagihan</div>
                    <div class="stat-value stat-remaining-val">Rp {{ number_format(max(0, $payable->total - $payable->paid), 0, ',', '.') }}</div>
                </div>
            </td>
        </tr>
    </table>

    <!-- Riwayat Pembayaran -->
    <div class="table-title">Riwayat Pembayaran</div>
    <table class="payment-table">
        <thead>
            <tr>
                <th style="width: 6%; text-align: center;">No</th>
                <th style="width: 22%;">Tanggal</th>
                <th style="width: 28%;">Metode / Bank</th>
                <th style="width: 22%;">Pencatat</th>
                <th style="width: 22%; text-align: right;">Jumlah</th>
            </tr>
        </thead>
        <tbody>
            @forelse($payable->payments as $index => $pay)
                <tr style="background: {{ $index % 2 === 0 ? '#ffffff' : '#f8fafc' }};">
                    <td style="text-align: center; color: #64748b;">{{ $index + 1 }}</td>
                    <td>
                        <div>{{ \Carbon\Carbon::parse($pay->paid_at)->format('d M Y') }}</div>
                        @if(!empty($pay->voucher_number))
                            <div style="font-family: monospace; font-size: 10px; color: #4338ca; font-weight: 600; margin-top: 2px;">{{ $pay->voucher_number }}</div>
                        @endif
                    </td>
                    <td>
                        @php
                            $methodKey = strtolower($pay->method ?? 'cash');
                            $methodLabelMap = [
                                'cash' => 'Tunai',
                                'bank_transfer' => 'Transfer Bank',
                                'qris' => 'QRIS',
                                'qrisly' => 'QRIS Dinamis',
                                'midtrans' => 'Midtrans',
                                'xendit' => 'Xendit',
                                'edc' => 'EDC',
                            ];
                            $methodLabel = $methodLabelMap[$methodKey] ?? ucwords(str_replace('_', ' ', $methodKey));
                        @endphp
                        <strong>{{ $methodLabel }}</strong>
                        @if($pay->bankAccount)
                            <div class="muted">{{ $pay->bankAccount->bank_name }} - {{ $pay->bankAccount->account_number }}</div>
                        @endif
                        @if($pay->note)
                            <div class="muted" style="font-style: italic;">{{ $pay->note }}</div>
                        @endif
                    </td>
                    <td>{{ $pay->user->name ?? '-' }}</td>
                    <td style="text-align: right; font-weight: 700;">Rp {{ number_format($pay->amount, 0, ',', '.') }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="5" style="text-align: center; color: #94a3b8; padding: 16px 0;">Belum ada riwayat pembayaran</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <!-- Footer -->
    <table class="footer-table">
        <tr>
            <td style="vertical-align: middle;">
                <div class="muted">Dicetak pada: {{ now()->translatedFormat('d F Y H:i') }}</div>
                <div class="muted" style="font-size: 9px; margin-top: 2px;">Dokumen ini dicetak otomatis dari sistem POS Rekasir</div>
            </td>
            <td style="vertical-align: middle; text-align: right;">
                @if(!empty($barcode))
                    <img src="{{ $barcode }}" alt="barcode" style="height: 32px; max-width: 200px;">
                    <div class="muted" style="font-size: 9px; font-weight: 700; letter-spacing: 1.5px; margin-top: 2px;">{{ $payable->document_number }}</div>
                @endif
            </td>
        </tr>
    </table>
</body>
</html>
