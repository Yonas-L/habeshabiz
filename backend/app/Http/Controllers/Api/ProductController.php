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

        if (! $request->boolean('include_inactive')) {
            $query->where('is_active', true);
        }

        $products = $query->orderBy('name')->get();

        return response()->json([
            'success' => true,
            'data' => $products,
        ]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Product catalog editing is restricted to store owners.',
            ], 403);
        }

        $product = Product::findOrFail($id);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'brand' => ['nullable', 'string', 'max:100'],
            'category_id' => ['nullable', 'exists:categories,id'],
            'category' => ['nullable', 'string', 'max:50'],
            'has_serials' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if (! empty($validated['category_id'])) {
            $cat = \App\Models\Category::find($validated['category_id']);
            if ($cat) {
                $validated['category'] = $cat->slug;
            }
        }

        $product->update($validated);

        return response()->json([
            'success' => true,
            'message' => "Product '{$product->name}' updated successfully.",
            'data' => $product->fresh(['categoryRel', 'variants.stock', 'variants.inventoryUnits' => fn ($q) => $q->where('status', 'in_stock')]),
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Product catalog deletion is restricted to store owners.',
            ], 403);
        }

        $product = Product::with(['variants'])->findOrFail($id);
        $variantIds = $product->variants->pluck('id')->toArray();

        // Check for active units in stock or out
        $activeUnitsCount = \App\Models\InventoryUnit::whereIn('variant_id', $variantIds)
            ->whereIn('status', ['in_stock', 'out'])
            ->count();

        if ($activeUnitsCount > 0) {
            return response()->json([
                'success' => false,
                'message' => "Cannot delete '{$product->name}' because it currently has {$activeUnitsCount} unit(s) in stock or out for sale. Transfer, sell, or mark them returned first.",
            ], 422);
        }

        // Check for historical sales or units
        $hasHistoricalSales = \App\Models\SalesOrderItem::whereIn('variant_id', $variantIds)->exists();
        $hasHistoricalUnits = \App\Models\InventoryUnit::whereIn('variant_id', $variantIds)->exists();

        if ($hasHistoricalSales || $hasHistoricalUnits) {
            $product->update(['is_active' => false]);
            return response()->json([
                'success' => true,
                'message' => "Product '{$product->name}' has historical sales records. It has been deactivated and archived from active stock.",
                'deactivated' => true,
            ]);
        }

        DB::transaction(function () use ($product) {
            $product->variants()->delete();
            $product->delete();
        });

        return response()->json([
            'success' => true,
            'message' => "Product '{$product->name}' and its variants were permanently deleted.",
            'deleted' => true,
        ]);
    }

    public function updateVariant(Request $request, string $id): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Editing product variants is restricted to store owners.',
            ], 403);
        }

        $variant = ProductVariant::findOrFail($id);

        $validated = $request->validate([
            'storage' => ['nullable', 'string', 'max:50'],
            'ram' => ['nullable', 'string', 'max:50'],
            'color' => ['nullable', 'string', 'max:50'],
            'specs' => ['nullable', 'array'],
            'sku' => ['nullable', 'string', 'max:100'],
            'default_selling_price' => ['nullable', 'numeric', 'min:0'],
        ]);

        $variant->update($validated);

        return response()->json([
            'success' => true,
            'message' => "Variant updated successfully.",
            'data' => $variant->fresh(['product']),
        ]);
    }

    public function destroyVariant(Request $request, string $id): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Deleting product variants is restricted to store owners.',
            ], 403);
        }

        $variant = ProductVariant::findOrFail($id);

        $activeUnits = \App\Models\InventoryUnit::where('variant_id', $variant->id)
            ->whereIn('status', ['in_stock', 'out'])
            ->count();

        if ($activeUnits > 0) {
            return response()->json([
                'success' => false,
                'message' => "Cannot delete variant because it has {$activeUnits} active unit(s) in inventory.",
            ], 422);
        }

        $hasSales = \App\Models\SalesOrderItem::where('variant_id', $variant->id)->exists();
        if ($hasSales) {
            return response()->json([
                'success' => false,
                'message' => "Cannot delete variant with historical sales records.",
            ], 422);
        }

        $variant->delete();

        return response()->json([
            'success' => true,
            'message' => "Variant deleted successfully.",
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
