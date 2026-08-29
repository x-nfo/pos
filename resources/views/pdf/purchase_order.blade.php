@php
    $fontFamily = "'Inter', 'Helvetica', 'Arial', sans-serif";
    $grandTotal = 0;
    $totalQty = 0;
@endphp
<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8">
    <style>
        @page {
            margin: 12mm 15mm;
        }

        * {
            box-sizing: border-box;
        }

        body {
            font-family: {{ $fontFamily }};
            margin: 0;
            padding: 0;
            color: #0f172a;
            font-size: 12px;
            line-height: 1.4;
        }

        .w-full {
            width: 100%;
        }

        .header-table {
            width: 100%;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 16px;
        }

        .store-name {
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
        }

        .muted {
            color: #64748b;
            font-size: 11px;
        }

        .doc-title {
            font-size: 20px;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: -0.5px;
            margin: 0;
        }

        .doc-badge {
            display: inline-block;
            background: #e0e7ff;
            color: #4338ca;
            font-size: 10px;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }

        .info-table {
            width: 100%;
            margin-bottom: 16px;
            border-collapse: collapse;
        }

        .info-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 12px;
            vertical-align: top;
        }

        .info-title {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #64748b;
            margin-bottom: 6px;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 3px;
        }

        .items-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            margin-top: 10px;
            margin-bottom: 16px;
        }

        .items-table th {
            background: #f1f5f9;
            color: #0f172a;
            font-weight: 700;
            font-size: 10.5px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            padding: 8px 5px;
            border-top: 1.5px solid #0f172a;
            border-bottom: 1.5px solid #0f172a;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }

        .items-table td {
            padding: 8px 5px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 11px;
            vertical-align: middle;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }

        .text-left { text-align: left; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-mono { font-family: monospace; }
        .font-bold { font-weight: 700; }

        .uom-badge {
            background: #f1f5f9;
            padding: 2px 5px;
            border-radius: 3px;
            font-size: 10px;
            color: #334155;
            display: inline-block;
        }

        .total-row td {
            border-top: 1.5px solid #0f172a;
            border-bottom: 1.5px solid #0f172a;
            font-weight: 700;
            padding: 8px 6px;
            font-size: 12px;
        }

        .notes-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 12px;
            margin-bottom: 14px;
            font-size: 11px;
        }

        .terms {
            border-top: 1px solid #e2e8f0;
            padding-top: 8px;
            margin-bottom: 24px;
            font-size: 10px;
            color: #64748b;
        }

        .signature-table {
            width: 100%;
            margin-top: 10px;
            text-align: center;
        }

        .signature-table td {
            width: 33.33%;
            vertical-align: top;
            padding: 0 10px;
        }

        .signature-line {
            margin-top: 60px;
            border-top: 1px solid #475569;
            padding-top: 4px;
            font-weight: 700;
            font-size: 11px;
            color: #0f172a;
        }
    </style>
</head>

<body>
    <!-- Header -->
    <table class="header-table">
        <tr>
            <td style="width: 55%; vertical-align: top;">
                @if(!empty($store['logo_data']))
                    <img src="{{ $store['logo_data'] }}" alt="Logo" style="height: 48px; max-width: 160px; object-fit: contain; margin-bottom: 4px;">
                @elseif(!empty($store['logo']))
                    <img src="{{ $store['logo'] }}" alt="Logo" style="height: 48px; max-width: 160px; object-fit: contain; margin-bottom: 4px;">
                @else
                    <div class="store-name">{{ $store['name'] }}</div>
                @endif
                <div class="store-name">{{ $store['name'] }}</div>
                @if(!empty($store['address']))
                    <div class="muted">{{ $store['address'] }}</div>
                @endif
                <div class="muted">
                    @if(!empty($store['phone'])) Telp: {{ $store['phone'] }} @endif
                    @if(!empty($store['email'])) &bull; Email: {{ $store['email'] }} @endif
                </div>
            </td>
            <td style="width: 45%; text-align: right; vertical-align: top;">
                <span class="doc-badge">Surat Pesanan Pembelian</span>
                <h1 class="doc-title">PURCHASE ORDER</h1>
                <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 4px; font-family: monospace;">
                    {{ $order->document_number }}
                </div>
                @if(!empty($barcode))
                    <div style="margin-top: 6px;">
                        <img src="{{ $barcode }}" alt="Barcode" style="height: 32px;">
                    </div>
                @endif
            </td>
        </tr>
    </table>

    <!-- Info Pihak & Dokumen (2 Kolom) -->
    <table class="info-table">
        <tr>
            <td style="width: 48%; vertical-align: top; padding-right: 8px;">
                <div class="info-box">
                    <div class="info-title">Kepada Supplier / Vendor</div>
                    <div style="font-size: 13px; font-weight: 700; color: #0f172a;">
                        {{ $order->supplier->name ?? 'Supplier Umum' }}
                    </div>
                    @if(!empty($order->supplier?->phone))
                        <div class="muted" style="margin-top: 2px;">Telepon: {{ $order->supplier->phone }}</div>
                    @endif
                    @if(!empty($order->supplier?->email))
                        <div class="muted">Email: {{ $order->supplier->email }}</div>
                    @endif
                    @if(!empty($order->supplier?->address))
                        <div class="muted" style="margin-top: 3px;">{{ $order->supplier->address }}</div>
                    @endif
                </div>
            </td>
            <td style="width: 48%; vertical-align: top; padding-left: 8px;">
                <div class="info-box">
                    <div class="info-title">Detail Pengiriman & Status</div>
                    <table style="width: 100%; font-size: 11px;">
                        <tr>
                            <td class="muted" style="width: 45%; padding: 1px 0;">Tanggal PO:</td>
                            <td style="font-weight: 600; padding: 1px 0;">
                                {{ \Carbon\Carbon::parse($order->created_at)->format('d F Y') }}
                            </td>
                        </tr>
                        @if($order->ordered_at)
                        <tr>
                            <td class="muted" style="padding: 1px 0;">Tanggal Pesan:</td>
                            <td style="font-weight: 600; padding: 1px 0;">
                                {{ \Carbon\Carbon::parse($order->ordered_at)->format('d M Y H:i') }}
                            </td>
                        </tr>
                        @endif
                        <tr>
                            <td class="muted" style="padding: 1px 0;">Gudang Tujuan:</td>
                            <td style="font-weight: 700; color: #0f172a; padding: 1px 0;">
                                {{ $order->warehouse ? $order->warehouse->code . ' - ' . $order->warehouse->name : 'Gudang Utama' }}
                            </td>
                        </tr>
                        <tr>
                            <td class="muted" style="padding: 1px 0;">Dibuat Oleh:</td>
                            <td style="font-weight: 600; padding: 1px 0;">
                                {{ $order->creator->name ?? '-' }}
                            </td>
                        </tr>
                        <tr>
                            <td class="muted" style="padding: 1px 0;">Status:</td>
                            <td style="font-weight: 700; color: #4338ca; text-transform: uppercase; padding: 1px 0;">
                                {{ $order->status }}
                            </td>
                        </tr>
                    </table>
                </div>
            </td>
        </tr>
    </table>

    <!-- Tabel Item -->
    <table class="items-table">
        <thead>
            <tr>
                <th class="text-center" style="width: 6%;">No</th>
                <th class="text-left" style="width: 16%;">SKU</th>
                <th class="text-left" style="width: 34%;">Deskripsi Barang</th>
                <th class="text-center" style="width: 12%;">Satuan</th>
                <th class="text-right" style="width: 8%;">Qty</th>
                <th class="text-right" style="width: 12%;">Harga Satuan</th>
                <th class="text-right" style="width: 12%;">Subtotal</th>
            </tr>
        </thead>
        <tbody>
            @forelse($order->items as $index => $item)
                @php
                    $qty = (float) ($item->qty_ordered ?? 0);
                    $unitPrice = (float) ($item->unit_price ?? 0);
                    $subtotal = $qty * $unitPrice;
                    $grandTotal += $subtotal;
                    $totalQty += $qty;
                    $unitName = $item->unit->symbol ?? ($item->unit->name ?? 'Pcs');
                    $conversion = (float) ($item->conversion_factor ?? 1);
                @endphp
                <tr>
                    <td class="text-center muted">{{ $index + 1 }}</td>
                    <td class="font-mono" style="font-size: 10.5px; color: #475569;">
                        {{ $item->product->sku ?? '-' }}
                    </td>
                    <td>
                        <span style="font-weight: 600;">{{ $item->product->title ?? 'Item #' . $item->product_id }}</span>
                    </td>
                    <td class="text-center">
                        <span class="uom-badge">
                            {{ $unitName }}
                            @if($conversion > 1) ({{ '@' . ($conversion == (int)$conversion ? (int)$conversion : $conversion) }}) @endif
                        </span>
                    </td>
                    <td class="text-right font-bold">{{ $qty }}</td>
                    <td class="text-right font-mono">Rp {{ number_format($unitPrice, 0, ',', '.') }}</td>
                    <td class="text-right font-mono font-bold">Rp {{ number_format($subtotal, 0, ',', '.') }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="7" class="text-center muted" style="padding: 20px;">Tidak ada item pada purchase order ini.</td>
                </tr>
            @endforelse
        </tbody>
        <tfoot>
            <tr class="total-row">
                <td colspan="4" class="text-right muted">
                    Total Item: {{ count($order->items) }} item ({{ $totalQty }} unit)
                </td>
                <td colspan="2" class="text-right" style="font-size: 11px;">
                    GRAND TOTAL ESTIMASI:
                </td>
                <td class="text-right font-mono font-bold" style="font-size: 13px; color: #1e1b4b;">
                    Rp {{ number_format($grandTotal, 0, ',', '.') }}
                </td>
            </tr>
        </tfoot>
    </table>

    <!-- Catatan Tambahan -->
    @if(!empty($order->notes))
        <div class="notes-box">
            <strong style="color: #334155;">Catatan Pemesanan / Instruksi Khusus:</strong>
            <p style="margin: 3px 0 0 0; color: #475569;">{{ $order->notes }}</p>
        </div>
    @endif

    <!-- Ketentuan Pemesanan -->
    <div class="terms">
        <strong>Ketentuan Pemesanan:</strong><br>
        1. Harap sertakan salinan Surat Pesanan (PO) ini pada saat pengiriman barang dan penagihan faktur.<br>
        2. Barang yang dikirim harus dalam kondisi baik, baru, dan sesuai dengan spesifikasi yang tercantum di atas.<br>
        3. Konfirmasi ketersediaan barang dan jadwal pengiriman dapat menghubungi kontak toko yang tertera.
    </div>

    <!-- Kolom Tanda Tangan -->
    <table class="signature-table">
        <tr>
            <td>
                <div class="muted">Dibuat Oleh (Purchasing):</div>
                <div class="signature-line">
                    {{ $order->creator->name ?? '( ......................... )' }}
                </div>
            </td>
            <td>
                <div class="muted">Disetujui Oleh (Pimpinan):</div>
                <div class="signature-line">
                    ( ......................... )
                </div>
            </td>
            <td>
                <div class="muted">Dikonfirmasi Supplier:</div>
                <div class="signature-line">
                    {{ $order->supplier->name ?? '( ......................... )' }}
                </div>
            </td>
        </tr>
    </table>
</body>

</html>
