@php
    $status = $receivable->status;
    $remaining = max(0, (float) ($receivable->remaining ?? ($receivable->total - $receivable->paid)));
    $statusText = 'Belum Lunas';
    $statusBg = '#fef3c7';
    $statusColor = '#b45309';
    $statusBorder = '#fde68a';

    if ($status === 'paid' || $remaining <= 0) {
        $statusText = 'Lunas';
        $statusBg = '#dcfce7';
        $statusColor = '#15803d';
        $statusBorder = '#bbf7d0';
    } elseif ($status === 'partial') {
        $statusText = 'Parsial';
        $statusBg = '#e0e7ff';
        $statusColor = '#4338ca';
        $statusBorder = '#c7d2fe';
    } elseif ($status === 'overdue' || ($receivable->due_date && now()->gt($receivable->due_date))) {
        $statusText = 'Jatuh Tempo';
        $statusBg = '#ffe4e6';
        $statusColor = '#be123c';
        $statusBorder = '#fecdd3';
    }

    $storeWords = preg_split('/\s+/', trim($store['name'] ?? 'POS'));
    if (count($storeWords) >= 2) {
        $initials = strtoupper(mb_substr($storeWords[0], 0, 1) . mb_substr($storeWords[1], 0, 1));
    } else {
        $initials = strtoupper(mb_substr($store['name'] ?? 'POS', 0, 2));
    }
@endphp
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Piutang {{ $receivable->invoice }}</title>
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
        .customer-name {
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
        .stat-card-danger {
            background: #fff1f2;
            border: 1px solid #fecdd3;
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
        .stat-danger-val {
            color: #e11d48;
        }
        .table-title {
            font-size: 11px;
            font-weight: 700;
            color: #334155;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            margin-bottom: 8px;
            margin-top: 14px;
        }
        .data-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            overflow: hidden;
            margin-bottom: 14px;
        }
        .data-table th {
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
        .data-table td {
            padding: 8px 10px;
            font-size: 11px;
            border-bottom: 1px solid #f1f5f9;
            color: #1e293b;
        }
        .data-table tr:last-child td {
            border-bottom: none;
        }
        .summary-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 12px;
            margin-bottom: 14px;
        }
        .bank-box {
            background: #f8fafc;
            border: 1px dashed #cbd5e1;
            border-radius: 8px;
            padding: 10px 14px;
            margin-bottom: 14px;
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
                        {{ $initials }}
                    </div>
                @endif
            </td>
            <td style="vertical-align: top;">
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
            <td style="vertical-align: top; text-align: right; width: 230px;">
                <div class="doc-title">Dokumen Piutang</div>
                <div class="doc-number">{{ $receivable->invoice }}</div>
                @if($receivable->transaction?->invoice)
                    <div class="muted">Faktur Penjualan: <strong>{{ $receivable->transaction->invoice }}</strong></div>
                @endif
                @if($receivable->transaction?->created_at)
                    <div class="muted">Tgl Transaksi: <strong>{{ $receivable->transaction->created_at->format('d M Y') }}</strong></div>
                @endif
                <div class="muted">Jatuh Tempo: <strong>{{ $receivable->due_date ? \Carbon\Carbon::parse($receivable->due_date)->format('d M Y') : '-' }}</strong></div>
            </td>
        </tr>
    </table>

    <!-- Subheader: Pelanggan & Status -->
    <table class="sub-header-table">
        <tr>
            <td style="vertical-align: top; width: 65%;">
                <div class="section-label">Pelanggan</div>
                <div class="customer-name">{{ $receivable->customer->name ?? 'Pelanggan Umum' }}</div>
                @if($receivable->customer?->phone || $receivable->customer?->no_telp)
                    <div class="muted">Telp: {{ $receivable->customer->phone ?? $receivable->customer->no_telp }}</div>
                @endif
                @if($receivable->customer?->address)
                    <div class="muted">{{ $receivable->customer->address }}</div>
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
                    <div class="stat-label">Total Piutang</div>
                    <div class="stat-value">Rp {{ number_format($receivable->total, 0, ',', '.') }}</div>
                </div>
            </td>
            <td style="width: 33.33%; padding: 0 4px; vertical-align: top;">
                <div class="stat-card-inner stat-card-paid">
                    <div class="stat-label" style="color: #15803d;">Terbayar</div>
                    <div class="stat-value stat-paid-val">Rp {{ number_format($receivable->paid, 0, ',', '.') }}</div>
                </div>
            </td>
            <td style="width: 33.33%; padding-left: 6px; vertical-align: top;">
                <div class="stat-card-inner {{ $status === 'overdue' ? 'stat-card-danger' : 'stat-card-warning' }}">
                    <div class="stat-label" style="color: {{ $status === 'overdue' ? '#be123c' : '#b45309' }};">Sisa Tagihan</div>
                    <div class="stat-value {{ $status === 'overdue' ? 'stat-danger-val' : 'stat-remaining-val' }}">Rp {{ number_format($remaining, 0, ',', '.') }}</div>
                </div>
            </td>
        </tr>
    </table>

    <!-- Rincian Transaksi Penjualan (jika ada) -->
    @if($receivable->transaction && $receivable->transaction->details && $receivable->transaction->details->isNotEmpty())
        <div class="table-title">Rincian Transaksi Penjualan</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width: 5%; text-align: center;">No</th>
                    <th style="width: 45%;">Produk / Item</th>
                    <th style="width: 18%; text-align: right;">Harga Satuan</th>
                    <th style="width: 12%; text-align: center;">Qty</th>
                    <th style="width: 20%; text-align: right;">Subtotal</th>
                </tr>
            </thead>
            <tbody>
                @foreach($receivable->transaction->details as $idx => $detail)
                    <tr style="background: {{ $idx % 2 === 0 ? '#ffffff' : '#f8fafc' }};">
                        <td style="text-align: center; color: #64748b;">{{ $idx + 1 }}</td>
                        <td>
                            <strong style="color: #0f172a;">{{ $detail->product->title ?? 'Produk' }}</strong>
                            @if($detail->unit)
                                <span class="muted">({{ $detail->unit->name }})</span>
                            @endif
                        </td>
                        <td style="text-align: right;">Rp {{ number_format($detail->price / max(1, $detail->qty), 0, ',', '.') }}</td>
                        <td style="text-align: center;">{{ $detail->qty }}</td>
                        <td style="text-align: right; font-weight: 600;">Rp {{ number_format($detail->price, 0, ',', '.') }}</td>
                    </tr>
                @endforeach
            </tbody>
            @if(($receivable->transaction->discount ?? 0) > 0 || ($receivable->transaction->shipping_cost ?? 0) > 0 || ($receivable->transaction->tax_total ?? 0) > 0)
                <tfoot>
                    <tr style="background: #f8fafc; border-top: 1px solid #e2e8f0;">
                        <td colspan="4" style="text-align: right; font-weight: 600; color: #64748b;">Total Barang:</td>
                        <td style="text-align: right; font-weight: 600;">Rp {{ number_format($receivable->transaction->details->sum('price'), 0, ',', '.') }}</td>
                    </tr>
                    @if(($receivable->transaction->discount ?? 0) > 0)
                        <tr style="background: #f8fafc;">
                            <td colspan="4" style="text-align: right; font-weight: 600; color: #64748b;">Diskon:</td>
                            <td style="text-align: right; font-weight: 600; color: #dc2626;">- Rp {{ number_format($receivable->transaction->discount, 0, ',', '.') }}</td>
                        </tr>
                    @endif
                    @if(($receivable->transaction->shipping_cost ?? 0) > 0)
                        <tr style="background: #f8fafc;">
                            <td colspan="4" style="text-align: right; font-weight: 600; color: #64748b;">Ongkos Kirim:</td>
                            <td style="text-align: right; font-weight: 600;">+ Rp {{ number_format($receivable->transaction->shipping_cost, 0, ',', '.') }}</td>
                        </tr>
                    @endif
                    @if(($receivable->transaction->tax_total ?? 0) > 0)
                        <tr style="background: #f8fafc;">
                            <td colspan="4" style="text-align: right; font-weight: 600; color: #64748b;">PPN ({{ number_format($receivable->transaction->tax_rate ?? 11, 0) }}%):</td>
                            <td style="text-align: right; font-weight: 600;">+ Rp {{ number_format($receivable->transaction->tax_total, 0, ',', '.') }}</td>
                        </tr>
                    @endif
                </tfoot>
            @endif
        </table>
    @endif

    <!-- Riwayat Pembayaran -->
    <div class="table-title">Riwayat Pembayaran</div>
    <table class="data-table">
        <thead>
            <tr>
                <th style="width: 5%; text-align: center;">No</th>
                <th style="width: 18%;">Tanggal</th>
                <th style="width: 27%;">Metode / Bank</th>
                <th style="width: 18%;">Pencatat</th>
                <th style="width: 12%; text-align: center;">Status</th>
                <th style="width: 20%; text-align: right;">Jumlah</th>
            </tr>
        </thead>
        <tbody>
            @forelse($receivable->payments as $index => $pay)
                <tr style="background: {{ $index % 2 === 0 ? '#ffffff' : '#f8fafc' }};">
                    <td style="text-align: center; color: #64748b;">{{ $index + 1 }}</td>
                    <td>{{ \Carbon\Carbon::parse($pay->paid_at)->format('d M Y') }}</td>
                    <td>
                        <strong>{{ strtoupper(str_replace('_', ' ', $pay->method ?? '-')) }}</strong>
                        @if($pay->bankAccount)
                            <div class="muted">{{ $pay->bankAccount->bank_name }} - {{ $pay->bankAccount->account_number }}</div>
                        @endif
                        @if($pay->note)
                            <div class="muted" style="font-style: italic;">{{ $pay->note }}</div>
                        @endif
                    </td>
                    <td>{{ $pay->user->name ?? '-' }}</td>
                    <td style="text-align: center;">
                        @if($pay->status === 'approved' || empty($pay->status))
                            <span style="color: #16a34a; font-weight: 700; font-size: 9.5px;">DISETUJUI</span>
                        @elseif($pay->status === 'pending')
                            <span style="color: #d97706; font-weight: 700; font-size: 9.5px;">MENUNGGU</span>
                        @elseif($pay->status === 'rejected')
                            <span style="color: #dc2626; font-weight: 700; font-size: 9.5px;">DITOLAK</span>
                        @else
                            <span class="muted" style="font-size: 9.5px;">{{ strtoupper($pay->status) }}</span>
                        @endif
                    </td>
                    <td style="text-align: right; font-weight: 700;">Rp {{ number_format($pay->amount, 0, ',', '.') }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="6" style="text-align: center; color: #94a3b8; padding: 16px 0;">Belum ada riwayat pembayaran</td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <!-- Rekening Pembayaran (jika masih ada sisa tagihan) -->
    @if($remaining > 0 && isset($bankAccounts) && $bankAccounts->isNotEmpty())
        <div class="bank-box">
            <div style="font-weight: 700; font-size: 10.5px; color: #334155; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.3px;">
                Rekening Pembayaran:
            </div>
            <div class="muted" style="margin-bottom: 6px;">Pembayaran tagihan piutang dapat ditransfer ke salah satu rekening resmi berikut:</div>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    @foreach($bankAccounts->take(3) as $account)
                        <td style="vertical-align: top; width: 33.33%; padding: 4px 6px;">
                            <div style="font-weight: 700; font-size: 11px; color: #0f172a;">{{ $account->bank_name }}</div>
                            <div style="font-weight: 800; font-size: 12px; color: #2563eb; letter-spacing: 0.5px;">{{ $account->account_number }}</div>
                            <div class="muted">a.n. {{ $account->account_name }}</div>
                        </td>
                    @endforeach
                </tr>
            </table>
        </div>
    @endif

    <!-- Catatan Tambahan (jika ada) -->
    @if($receivable->note || $receivable->collection_notes)
        <div class="summary-box">
            @if($receivable->note)
                <div>
                    <strong style="color: #475569;">Catatan:</strong>
                    <span style="color: #1e293b;">{{ $receivable->note }}</span>
                </div>
            @endif
            @if($receivable->collection_notes)
                <div style="{{ $receivable->note ? 'margin-top: 4px;' : '' }}">
                    <strong style="color: #475569;">Catatan Penagihan:</strong>
                    <span style="color: #1e293b;">{{ $receivable->collection_notes }}</span>
                </div>
            @endif
        </div>
    @endif

    <!-- Footer -->
    <table class="footer-table">
        <tr>
            <td style="vertical-align: middle;">
                <div class="muted">Dicetak pada: {{ now()->translatedFormat('d F Y H:i') }}</div>
                <div class="muted" style="font-size: 9px; margin-top: 2px;">Dokumen ini dicetak otomatis dari sistem POS Rekasir</div>
            </td>
            <td style="vertical-align: middle; text-align: right; width: 220px;">
                @if(!empty($barcode))
                    <img src="{{ $barcode }}" alt="barcode" style="height: 32px; max-width: 200px;">
                    <div class="muted" style="font-size: 9px; font-weight: 700; letter-spacing: 1.5px; margin-top: 2px;">{{ $receivable->invoice }}</div>
                @endif
            </td>
        </tr>
    </table>
</body>
</html>
