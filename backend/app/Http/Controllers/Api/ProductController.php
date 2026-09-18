<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Product::with([
            'variants.stock',
            'variants.inventoryUnits' => fn ($q) => $q->where('status', 'in_stock'),
        ]);

        if ($request->has('category') && $request->category !== 'all') {
            $query->where('category', $request->category);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where('name', 'ilike', "%{$search}%");
        }

        $products = $query->orderBy('name')->get();

        return response()->json([
            'success' => true,
            'data' => $products,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'brand' => ['nullable', 'string', 'max:100'],
            'category' => ['required', 'string', 'max:50'],
            'has_serials' => ['boolean'],
            'variants' => ['required', 'array', 'min:1'],
            'variants.*.storage' => ['nullable', 'string', 'max:50'],
            'variants.*.ram' => ['nullable', 'string', 'max:50'],
            'variants.*.color' => ['nullable', 'string', 'max:50'],
            'variants.*.default_selling_price' => ['nullable', 'numeric', 'min:0'],
        ]);

        $product = DB::transaction(function () use ($validated) {
            $product = Product::create([
                'name' => $validated['name'],
                'brand' => $validated['brand'] ?? null,
                'category' => $validated['category'],
                'has_serials' => $validated['has_serials'] ?? true,
                'is_active' => true,
            ]);

            foreach ($validated['variants'] as $v) {
                ProductVariant::create([
                    'product_id' => $product->id,
                    'storage' => $v['storage'] ?? null,
                    'ram' => $v['ram'] ?? null,
                    'color' => $v['color'] ?? null,
                    'default_selling_price' => $v['default_selling_price'] ?? null,
                ]);
            }

            return $product->load('variants');
        });

        return response()->json([
            'success' => true,
            'message' => 'Product created successfully.',
            'data' => $product,
        ], 201);
    }
}
