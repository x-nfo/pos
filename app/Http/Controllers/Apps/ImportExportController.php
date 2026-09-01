<?php

namespace App\Http\Controllers\Apps;

use App\Exports\CustomersExport;
use App\Exports\ProductsExport;
use App\Exports\TransactionsExport;
use App\Http\Controllers\Controller;
use App\Imports\CustomersImport;
use App\Imports\ProductsImport;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Facades\Excel;
use Maatwebsite\Excel\Validators\ValidationException;

class ImportExportController extends Controller
{
    public function exportProducts()
    {
        return Excel::download(new ProductsExport, 'produk.xlsx');
    }

    public function exportCustomers()
    {
        return Excel::download(new CustomersExport, 'customer.xlsx');
    }

    public function exportTransactions(Request $request)
    {
        return Excel::download(new TransactionsExport($request), 'transaksi.xlsx');
    }

    public function importProducts(Request $request)
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv,txt', 'max:5120'],
            'warehouse_id' => ['required', 'exists:warehouses,id'],
        ]);

        try {
            $import = new ProductsImport($request->warehouse_id);
            DB::transaction(function () use ($import, $request) {
                Excel::import($import, $request->file('file'));
            });

            $successCount = $import->getRowCount();

            return back()->with('success', "Import selesai. {$successCount} produk diimport.");
        } catch (ValidationException $e) {
            $failures = $e->failures();
            $messages = [];
            foreach (array_slice($failures, 0, 5) as $failure) {
                $messages[] = "Baris {$failure->row()}: ".implode(', ', $failure->errors());
            }
            $errorText = implode(' | ', $messages);
            if (count($failures) > 5) {
                $errorText .= ' (dan '.(count($failures) - 5).' error lainnya)';
            }

            return back()->with('error', "Gagal validasi file import: {$errorText}");
        } catch (\Throwable $e) {
            return back()->with('error', "Gagal mengimport produk: {$e->getMessage()}");
        }
    }

    public function importCustomers(Request $request)
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv,txt', 'max:5120'],
        ]);

        try {
            $import = new CustomersImport;
            DB::transaction(function () use ($import, $request) {
                Excel::import($import, $request->file('file'));
            });

            return back()->with('success', 'Import customer selesai.');
        } catch (ValidationException $e) {
            $failures = $e->failures();
            $messages = [];
            foreach (array_slice($failures, 0, 5) as $failure) {
                $messages[] = "Baris {$failure->row()}: ".implode(', ', $failure->errors());
            }
            $errorText = implode(' | ', $messages);
            if (count($failures) > 5) {
                $errorText .= ' (dan '.(count($failures) - 5).' error lainnya)';
            }

            return back()->with('error', "Gagal validasi file import: {$errorText}");
        } catch (\Throwable $e) {
            return back()->with('error', "Gagal mengimport customer: {$e->getMessage()}");
        }
    }

    public function downloadTemplate(string $type)
    {
        $headings = match ($type) {
            'products' => ['barcode', 'sku', 'nama', 'deskripsi', 'kategori', 'harga_beli', 'harga_jual', 'stok', 'min_stok', 'max_stok', 'tipe_pajak', 'tarif_pajak'],
            'customers' => ['nama', 'telepon', 'alamat'],
            default => abort(404),
        };

        return Excel::download(
            new class($headings) implements FromArray, WithHeadings
            {
                public function __construct(private array $headings) {}

                public function headings(): array
                {
                    return $this->headings;
                }

                public function array(): array
                {
                    return [];
                }
            },
            "template-{$type}.xlsx"
        );
    }
}
