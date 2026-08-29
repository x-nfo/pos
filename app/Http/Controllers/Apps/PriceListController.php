<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\CustomerSegment;
use App\Models\PriceList;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class PriceListController extends Controller
{
    public function index()
    {
        $priceLists = PriceList::with('segment:id,name')
            ->withCount('items')
            ->orderByDesc('priority')
            ->orderBy('id')
            ->get();

        $customerSegments = CustomerSegment::orderBy('name')->get(['id', 'name']);

        return Inertia::render('Dashboard/Settings/PriceLists', [
            'priceLists' => $priceLists,
            'customerSegments' => $customerSegments,
        ]);
    }

    public function show(PriceList $priceList)
    {
        $priceList->load([
            'segment:id,name',
            'items.product' => function ($query) {
                $query->select('id', 'title', 'sku', 'barcode', 'category_id', 'buy_price', 'sell_price')
                    ->with('category:id,name');
            },
        ]);

        $products = Product::with('category:id,name')
            ->orderBy('title')
            ->get(['id', 'title', 'sku', 'barcode', 'category_id', 'buy_price', 'sell_price']);

        $categories = Category::orderBy('name')->get(['id', 'name']);

        return Inertia::render('Dashboard/Settings/PriceListItems', [
            'priceList' => $priceList,
            'products' => $products,
            'categories' => $categories,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'slug' => ['required', 'string', 'max:100', 'unique:price_lists,slug'],
            'customer_scope' => ['required', Rule::in(['all', 'walk_in', 'registered', 'member', 'segment'])],
            'customer_segment_id' => ['nullable', 'exists:customer_segments,id', 'required_if:customer_scope,segment'],
            'is_active' => ['nullable', 'boolean'],
            'priority' => ['integer', 'min:0'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $validated['is_active'] = $request->boolean('is_active', true);
        if ($validated['customer_scope'] !== 'segment') {
            $validated['customer_segment_id'] = null;
        }

        PriceList::create($validated);

        return back()->with('success', 'Price list berhasil dibuat.');
    }

    public function update(Request $request, PriceList $priceList)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'slug' => ['required', 'string', 'max:100', Rule::unique('price_lists', 'slug')->ignore($priceList->id)],
            'customer_scope' => ['required', Rule::in(['all', 'walk_in', 'registered', 'member', 'segment'])],
            'customer_segment_id' => ['nullable', 'exists:customer_segments,id', 'required_if:customer_scope,segment'],
            'is_active' => ['boolean'],
            'priority' => ['integer', 'min:0'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        if ($validated['customer_scope'] !== 'segment') {
            $validated['customer_segment_id'] = null;
        }

        $priceList->update($validated);

        return back()->with('success', 'Price list diperbarui.');
    }

    public function destroy(PriceList $priceList)
    {
        $priceList->delete();

        return back()->with('success', 'Price list dihapus.');
    }

    public function updateItem(Request $request, PriceList $priceList)
    {
        $request->validate([
            'product_id' => ['required', 'exists:products,id'],
            'price' => ['required', 'numeric', 'min:0'],
        ]);

        $priceList->items()->updateOrCreate(
            ['product_id' => $request->product_id],
            ['price' => (int) round($request->price)]
        );

        return back()->with('success', 'Harga produk berhasil disimpan.');
    }

    public function destroyItem(PriceList $priceList, $productId)
    {
        $priceList->items()->where('product_id', $productId)->delete();

        return back()->with('success', 'Item dihapus dari price list.');
    }

    public function bulkUpdateItems(Request $request, PriceList $priceList)
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.price' => ['required', 'numeric', 'min:0'],
        ]);

        DB::transaction(function () use ($priceList, $validated) {
            foreach ($validated['items'] as $item) {
                $priceList->items()->updateOrCreate(
                    ['product_id' => $item['product_id']],
                    ['price' => (int) round($item['price'])]
                );
            }
        });

        $count = count($validated['items']);

        return back()->with('success', "{$count} harga produk berhasil disimpan ke price list.");
    }

    public function bulkDestroyItems(Request $request, PriceList $priceList)
    {
        $validated = $request->validate([
            'product_ids' => ['required', 'array', 'min:1'],
            'product_ids.*' => ['required', 'exists:products,id'],
        ]);

        $deleted = $priceList->items()->whereIn('product_id', $validated['product_ids'])->delete();

        return back()->with('success', "{$deleted} item berhasil dihapus dari price list.");
    }
}
