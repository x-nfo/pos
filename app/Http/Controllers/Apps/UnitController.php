<?php

namespace App\Http\Controllers\Apps;

use App\Http\Controllers\Controller;
use App\Models\Unit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class UnitController extends Controller
{
    /**
     * Display a listing of units.
     */
    public function index(Request $request): Response
    {
        $units = Unit::query()
            ->withCount('productUnits')
            ->when($request->search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('code', 'like', "%{$search}%")
                        ->orWhere('symbol', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->paginate($this->perPage())
            ->withQueryString();

        return Inertia::render('Dashboard/Units/Index', [
            'units' => $units,
        ]);
    }

    /**
     * Show the form for creating a new unit.
     */
    public function create(): Response
    {
        return Inertia::render('Dashboard/Units/Create');
    }

    /**
     * Store a newly created unit in storage.
     */
    public function store(Request $request)
    {
        if ($request->has('code')) {
            $request->merge([
                'code' => strtoupper(trim((string) $request->input('code'))),
            ]);
        }

        $validated = $request->validate([
            'code' => ['required', 'string', 'max:10', 'unique:units,code'],
            'name' => ['required', 'string', 'max:50'],
            'symbol' => ['required', 'string', 'max:10'],
        ], [
            'code.required' => 'Kode satuan wajib diisi.',
            'code.unique' => 'Kode satuan sudah terdaftar.',
            'code.max' => 'Kode satuan maksimal 10 karakter.',
            'name.required' => 'Nama satuan wajib diisi.',
            'name.max' => 'Nama satuan maksimal 50 karakter.',
            'symbol.required' => 'Simbol satuan wajib diisi.',
            'symbol.max' => 'Simbol satuan maksimal 10 karakter.',
        ]);

        Unit::create($validated);

        return to_route('units.index')->with('success', 'Satuan berhasil ditambahkan.');
    }

    /**
     * Quick store a unit via JSON / AJAX (e.g. from Product Create/Edit modal).
     */
    public function quickStore(Request $request): JsonResponse
    {
        if ($request->has('code')) {
            $request->merge([
                'code' => strtoupper(trim((string) $request->input('code'))),
            ]);
        }

        $validated = $request->validate([
            'code' => ['required', 'string', 'max:10', 'unique:units,code'],
            'name' => ['required', 'string', 'max:50'],
            'symbol' => ['required', 'string', 'max:10'],
        ]);

        $unit = Unit::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Satuan berhasil ditambahkan.',
            'data' => $unit,
        ], 201);
    }

    /**
     * Show the form for editing the specified unit.
     */
    public function edit(Unit $unit): Response
    {
        return Inertia::render('Dashboard/Units/Edit', [
            'unit' => $unit->loadCount('productUnits'),
        ]);
    }

    /**
     * Update the specified unit in storage.
     */
    public function update(Request $request, Unit $unit)
    {
        if ($request->has('code')) {
            $request->merge([
                'code' => strtoupper(trim((string) $request->input('code'))),
            ]);
        }

        $validated = $request->validate([
            'code' => [
                'required',
                'string',
                'max:10',
                Rule::unique('units', 'code')->ignore($unit->id),
            ],
            'name' => ['required', 'string', 'max:50'],
            'symbol' => ['required', 'string', 'max:10'],
        ], [
            'code.required' => 'Kode satuan wajib diisi.',
            'code.unique' => 'Kode satuan sudah terdaftar.',
            'code.max' => 'Kode satuan maksimal 10 karakter.',
            'name.required' => 'Nama satuan wajib diisi.',
            'name.max' => 'Nama satuan maksimal 50 karakter.',
            'symbol.required' => 'Simbol satuan wajib diisi.',
            'symbol.max' => 'Simbol satuan maksimal 10 karakter.',
        ]);

        $unit->update($validated);

        return to_route('units.index')->with('success', 'Satuan berhasil diperbarui.');
    }

    /**
     * Remove the specified unit from storage.
     */
    public function destroy(Unit $unit)
    {
        if ($unit->hasHistoricalRelations()) {
            return back()->with('error', 'Satuan tidak dapat dihapus karena masih digunakan oleh produk atau data operasional.');
        }

        $unit->delete();

        return to_route('units.index')->with('success', 'Satuan berhasil dihapus.');
    }
}
