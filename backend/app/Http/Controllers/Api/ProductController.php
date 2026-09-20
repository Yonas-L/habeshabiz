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
            'categoryRel',
            'variants.stock',
            'variants.inventoryUnits' => fn ($q) => $q->where('status', 'in_stock'),
        ]);

        if ($request->filled('category_id') && $request->category_id !== 'all') {
            $query->where('category_id', $request->category_id);
        } elseif ($request->filled('category') && $request->category !== 'all') {
            $cat = $request->category;
            $query->where(function ($q) use ($cat) {
                $q->where('category', $cat)
                  ->orWhereHas('categoryRel', fn ($cq) => $cq->where('slug', $cat));
            });
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                  ->orWhere('brand', 'ilike', "%{$search}%");
            });
        }

        $products = $query->orderBy('name')->get();

        return response()->json([
            'success' => true,
            'data' => $products,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Product catalog creation is restricted to store owners/administrators.',
            ], 403);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'brand' => ['nullable', 'string', 'max:100'],
            'category_id' => ['nullable', 'exists:categories,id'],
            'category' => ['nullable', 'string', 'max:50'],
            'has_serials' => ['boolean'],
            'variants' => ['required', 'array', 'min:1'],
            'variants.*.storage' => ['nullable', 'string', 'max:50'],
            'variants.*.ram' => ['nullable', 'string', 'max:50'],
            'variants.*.color' => ['nullable', 'string', 'max:50'],
            'variants.*.specs' => ['nullable', 'array'],
            'variants.*.default_selling_price' => ['nullable', 'numeric', 'min:0'],
        ]);

        // Auto-resolve category slug from category_id if needed
        $categorySlug = $validated['category'] ?? 'gadgets';
        if (! empty($validated['category_id'])) {
            $cat = \App\Models\Category::find($validated['category_id']);
            if ($cat) {
                $categorySlug = $cat->slug;
                if (! isset($validated['has_serials'])) {
                    $validated['has_serials'] = $cat->has_serials;
                }
            }
        }

        $product = DB::transaction(function () use ($validated, $categorySlug) {
            $product = Product::create([
                'name' => $validated['name'],
                'brand' => $validated['brand'] ?? null,
                'category_id' => $validated['category_id'] ?? null,
                'category' => $categorySlug,
                'has_serials' => $validated['has_serials'] ?? true,
                'is_active' => true,
            ]);

            foreach ($validated['variants'] as $v) {
                ProductVariant::create([
                    'product_id' => $product->id,
                    'storage' => $v['storage'] ?? null,
                    'ram' => $v['ram'] ?? null,
                    'color' => $v['color'] ?? null,
                    'specs' => $v['specs'] ?? null,
                    'default_selling_price' => $v['default_selling_price'] ?? null,
                ]);
            }

            return $product->load(['categoryRel', 'variants']);
        });

        return response()->json([
            'success' => true,
            'message' => 'Product created successfully.',
            'data' => $product,
        ], 201);
    }

    public function addVariant(Request $request, string $id): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Adding product variants is restricted to store owners/administrators.',
            ], 403);
        }

        $product = Product::findOrFail($id);

        $validated = $request->validate([
            'storage' => ['nullable', 'string', 'max:50'],
            'ram' => ['nullable', 'string', 'max:50'],
            'color' => ['nullable', 'string', 'max:50'],
            'specs' => ['nullable', 'array'],
            'sku' => ['nullable', 'string', 'max:100'],
            'default_selling_price' => ['nullable', 'numeric', 'min:0'],
        ]);

        $variant = ProductVariant::create(array_merge($validated, [
            'product_id' => $product->id,
        ]));

        return response()->json([
            'success' => true,
            'message' => "Variant '{$variant->display_name}' added to {$product->name}.",
            'data' => $variant->load('product'),
        ], 201);
    }
}
