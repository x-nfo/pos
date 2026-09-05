<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\PromoBanner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PromoBannerController extends Controller
{
    /**
     * Store a newly created promo banner in storage.
     */
    public function store(Request $request)
    {
        $request->validate([
            'title' => 'nullable|string|max:255',
            'subtitle' => 'nullable|string|max:255',
            'image' => 'required|image|mimes:jpg,jpeg,png,webp|max:3072',
            'link_url' => 'nullable|string|max:500',
            'category_id' => 'nullable|exists:categories,id',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        $imagePath = $request->file('image')->store('banners', 'public');

        PromoBanner::create([
            'title' => $request->title,
            'subtitle' => $request->subtitle,
            'image' => $imagePath,
            'link_url' => $request->link_url,
            'category_id' => $request->category_id ?: null,
            'is_active' => $request->has('is_active') ? $request->boolean('is_active') : true,
            'sort_order' => (int) ($request->sort_order ?? 0),
        ]);

        return back()->with('success', 'Banner promo berhasil ditambahkan.');
    }

    /**
     * Update the specified promo banner in storage.
     */
    public function update(Request $request, PromoBanner $promoBanner)
    {
        $request->validate([
            'title' => 'nullable|string|max:255',
            'subtitle' => 'nullable|string|max:255',
            'image' => 'nullable|image|mimes:jpg,jpeg,png,webp|max:3072',
            'link_url' => 'nullable|string|max:500',
            'category_id' => 'nullable|exists:categories,id',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        if ($request->hasFile('image')) {
            if ($promoBanner->image && Storage::disk('public')->exists($promoBanner->image)) {
                Storage::disk('public')->delete($promoBanner->image);
            }
            $promoBanner->image = $request->file('image')->store('banners', 'public');
        }

        $promoBanner->title = $request->title;
        $promoBanner->subtitle = $request->subtitle;
        $promoBanner->link_url = $request->link_url;
        $promoBanner->category_id = $request->category_id ?: null;
        if ($request->has('is_active')) {
            $promoBanner->is_active = $request->boolean('is_active');
        }
        if ($request->has('sort_order')) {
            $promoBanner->sort_order = (int) $request->sort_order;
        }

        $promoBanner->save();

        return back()->with('success', 'Banner promo berhasil diperbarui.');
    }

    /**
     * Remove the specified promo banner from storage.
     */
    public function destroy(PromoBanner $promoBanner)
    {
        if ($promoBanner->image && Storage::disk('public')->exists($promoBanner->image)) {
            Storage::disk('public')->delete($promoBanner->image);
        }

        $promoBanner->delete();

        return back()->with('success', 'Banner promo berhasil dihapus.');
    }

    /**
     * Toggle the active status of the specified promo banner.
     */
    public function toggleActive(PromoBanner $promoBanner)
    {
        $promoBanner->is_active = ! $promoBanner->is_active;
        $promoBanner->save();

        return back()->with('success', 'Status banner promo berhasil diubah.');
    }

    /**
     * Update order of promo banners.
     */
    public function updateOrder(Request $request)
    {
        $request->validate([
            'orders' => 'required|array',
            'orders.*.id' => 'required|exists:promo_banners,id',
            'orders.*.sort_order' => 'required|integer',
        ]);

        foreach ($request->orders as $item) {
            PromoBanner::where('id', $item['id'])->update(['sort_order' => $item['sort_order']]);
        }

        return back()->with('success', 'Urutan banner promo berhasil disimpan.');
    }
}
