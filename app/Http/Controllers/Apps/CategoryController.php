<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\SizeChart;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class CategoryController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return Response
     */
    public function index()
    {
        // get categories
        $categories = Category::when(request()->search, function ($categories) {
            $categories = $categories->where('name', 'like', '%'.request()->search.'%');
        })->latest()->paginate($this->perPage())->withQueryString();

        // return inertia
        return Inertia::render('Dashboard/Categories/Index', [
            'categories' => $categories,
        ]);
    }

    /**
     * Show the form for creating a new resource.
     *
     * @return Response
     */
    public function create()
    {
        $sizeCharts = SizeChart::where('is_active', true)->orderBy('name')->get(['id', 'name', 'code', 'apparel_type']);

        return Inertia::render('Dashboard/Categories/Create', [
            'sizeCharts' => $sizeCharts,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     *
     * @return Response
     */
    public function store(Request $request)
    {
        /**
         * validate
         */
        $request->validate([
            'image' => 'nullable|image|mimes:jpeg,jpg,png|max:2048',
            'name' => 'required',
            'description' => 'nullable',
            'size_chart_id' => 'nullable|integer|exists:size_charts,id',
        ]);

        // upload image
        $imageName = null;
        if ($request->hasFile('image')) {
            $image = $request->file('image');
            $imageName = $image->hashName();
            $image->storeAs('public/category', $imageName);
        }

        // create category
        Category::create([
            'image' => $imageName,
            'name' => $request->name,
            'description' => $request->description,
            'size_chart_id' => $request->size_chart_id,
        ]);

        // redirect
        return to_route('categories.index');
    }

    /**
     * Quick store a category via JSON / AJAX (e.g. from Product Create/Edit modal).
     */
    public function quickStore(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:categories,name'],
            'description' => ['nullable', 'string'],
            'image' => ['nullable', 'image', 'mimes:jpeg,jpg,png,webp', 'max:2048'],
        ]);

        $imageName = null;
        if ($request->hasFile('image')) {
            $image = $request->file('image');
            $imageName = $image->hashName();
            $image->storeAs('public/category', $imageName);
        }

        $category = Category::create([
            'image' => $imageName,
            'name' => $validated['name'],
            'description' => $validated['description'] ?? '',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Kategori berhasil ditambahkan.',
            'data' => $category,
        ], 201);
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param  int  $id
     * @return Response
     */
    public function edit(Category $category)
    {
        $sizeCharts = SizeChart::where('is_active', true)->orderBy('name')->get(['id', 'name', 'code', 'apparel_type']);

        return Inertia::render('Dashboard/Categories/Edit', [
            'category' => $category,
            'sizeCharts' => $sizeCharts,
        ]);
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  int  $id
     * @return Response
     */
    public function update(Request $request, Category $category)
    {
        /**
         * validate
         */
        $request->validate([
            'name' => 'required',
            'description' => 'nullable',
            'size_chart_id' => 'nullable|integer|exists:size_charts,id',
        ]);

        // check image update
        if ($request->file('image')) {

            // remove old image
            if ($category->image) {
                Storage::disk('local')->delete('public/category/'.basename($category->image));
            }

            // upload new image
            $image = $request->file('image');
            $image->storeAs('public/category', $image->hashName());

            // update category with new image
            $category->update([
                'image' => $image->hashName(),
                'name' => $request->name,
                'description' => $request->description,
                'size_chart_id' => $request->size_chart_id,
            ]);
        }

        // update category without image
        $category->update([
            'name' => $request->name,
            'description' => $request->description,
            'size_chart_id' => $request->size_chart_id,
        ]);

        // redirect
        return to_route('categories.index');
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return Response
     */
    public function destroy($id)
    {
        // find by ID
        $category = Category::findOrFail($id);

        if ($category->hasHistoricalRelations()) {
            return back()->with('error', 'Kategori tidak dapat dihapus karena masih digunakan oleh produk atau aturan harga.');
        }

        // remove image
        if ($category->image) {
            Storage::disk('local')->delete('public/category/'.basename($category->image));
        }

        // delete
        $category->delete();

        // redirect
        return to_route('categories.index')->with('success', 'Kategori berhasil dihapus.');
    }
}
