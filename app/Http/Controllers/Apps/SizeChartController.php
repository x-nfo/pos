<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\SizeChart;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SizeChartController extends Controller
{
    /**
     * Display a listing of size charts.
     */
    public function index(Request $request): Response
    {
        $sizeCharts = SizeChart::query()
            ->withCount(['categories', 'products'])
            ->when($request->search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%")
                        ->orWhere('apparel_type', 'like', "%{$search}%");
                });
            })
            ->latest()
            ->paginate($this->perPage())
            ->withQueryString();

        return Inertia::render('Dashboard/SizeCharts/Index', [
            'sizeCharts' => $sizeCharts,
        ]);
    }

    /**
     * Show the form for creating a new size chart.
     */
    public function create(): Response
    {
        return Inertia::render('Dashboard/SizeCharts/Create');
    }

    /**
     * Store a newly created size chart in storage.
     */
    public function store(Request $request): RedirectResponse
    {
        if ($request->has('code')) {
            $request->merge([
                'code' => strtoupper(trim((string) $request->input('code'))),
            ]);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:50', 'unique:size_charts,code'],
            'apparel_type' => ['required', 'string', Rule::in(['tops', 'bottoms', 'footwear', 'headwear', 'accessories'])],
            'default_unit' => ['required', 'string', Rule::in(['cm', 'inch'])],
            'columns' => ['required', 'array', 'min:1'],
            'columns.*.key' => ['required', 'string', 'max:50'],
            'columns.*.label' => ['required', 'string', 'max:100'],
            'measurements' => ['required', 'array', 'min:1'],
            'measurements.*.size' => ['required', 'string', 'max:50'],
            'fit_rules' => ['nullable', 'array'],
            'how_to_measure_notes' => ['nullable', 'string'],
            'is_active' => ['boolean'],
        ]);

        SizeChart::create([
            'name' => $validated['name'],
            'code' => $validated['code'],
            'apparel_type' => $validated['apparel_type'],
            'default_unit' => $validated['default_unit'],
            'columns' => $validated['columns'],
            'measurements' => $validated['measurements'],
            'fit_rules' => $validated['fit_rules'] ?? [],
            'how_to_measure_notes' => $validated['how_to_measure_notes'] ?? null,
            'is_active' => $request->boolean('is_active', true),
        ]);

        return to_route('size-charts.index')
            ->with('success', 'Panduan ukuran berhasil ditambahkan.');
    }

    /**
     * Show the form for editing the specified size chart.
     */
    public function edit(SizeChart $sizeChart): Response
    {
        return Inertia::render('Dashboard/SizeCharts/Edit', [
            'sizeChart' => $sizeChart,
        ]);
    }

    /**
     * Update the specified size chart in storage.
     */
    public function update(Request $request, SizeChart $sizeChart): RedirectResponse
    {
        if ($request->has('code')) {
            $request->merge([
                'code' => strtoupper(trim((string) $request->input('code'))),
            ]);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:50', Rule::unique('size_charts', 'code')->ignore($sizeChart->id)],
            'apparel_type' => ['required', 'string', Rule::in(['tops', 'bottoms', 'footwear', 'headwear', 'accessories'])],
            'default_unit' => ['required', 'string', Rule::in(['cm', 'inch'])],
            'columns' => ['required', 'array', 'min:1'],
            'columns.*.key' => ['required', 'string', 'max:50'],
            'columns.*.label' => ['required', 'string', 'max:100'],
            'measurements' => ['required', 'array', 'min:1'],
            'measurements.*.size' => ['required', 'string', 'max:50'],
            'fit_rules' => ['nullable', 'array'],
            'how_to_measure_notes' => ['nullable', 'string'],
            'is_active' => ['boolean'],
        ]);

        $sizeChart->update([
            'name' => $validated['name'],
            'code' => $validated['code'],
            'apparel_type' => $validated['apparel_type'],
            'default_unit' => $validated['default_unit'],
            'columns' => $validated['columns'],
            'measurements' => $validated['measurements'],
            'fit_rules' => $validated['fit_rules'] ?? [],
            'how_to_measure_notes' => $validated['how_to_measure_notes'] ?? null,
            'is_active' => $request->boolean('is_active', true),
        ]);

        return to_route('size-charts.index')
            ->with('success', 'Panduan ukuran berhasil diperbarui.');
    }

    /**
     * Remove the specified size chart from storage.
     */
    public function destroy(SizeChart $sizeChart): RedirectResponse
    {
        $hasUsage = $sizeChart->products()->exists() || $sizeChart->categories()->exists();

        if ($hasUsage) {
            return back()->with('error', 'Panduan ukuran tidak dapat dihapus karena sedang digunakan oleh produk atau kategori aktif.');
        }

        $sizeChart->delete();

        return to_route('size-charts.index')
            ->with('success', 'Panduan ukuran berhasil dihapus.');
    }

    /**
     * Fetch active size charts as JSON for dropdowns.
     */
    public function listActive(): JsonResponse
    {
        $charts = SizeChart::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'apparel_type']);

        return response()->json($charts);
    }
}
