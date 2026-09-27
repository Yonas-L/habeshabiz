<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $categories = Category::withCount('products')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        // Calculate in-stock units count for each category
        foreach ($categories as $cat) {
            $serialized = \App\Models\InventoryUnit::where('status', 'in_stock')
                ->whereHas('variant.product', function ($q) use ($cat) {
                    $q->where('category_id', $cat->id)
                      ->orWhere('category', $cat->slug);
                })
                ->count();

            $nonSerialized = (int) \App\Models\InventoryStock::whereHas('variant.product', function ($q) use ($cat) {
                    $q->where('has_serials', false)
                      ->where(function ($pq) use ($cat) {
                          $pq->where('category_id', $cat->id)
                             ->orWhere('category', $cat->slug);
                      });
                })
                ->sum('quantity_on_hand');

            $cat->in_stock_units_count = $serialized + $nonSerialized;
        }

        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Category management is restricted to store owners/administrators.',
            ], 403);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'slug' => ['nullable', 'string', 'max:100'],
            'icon' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string'],
            'has_serials' => ['boolean'],
            'spec_fields' => ['nullable', 'array'],
            'sort_order' => ['nullable', 'integer'],
        ]);

        if (empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['name']);
        }

        // Ensure unique slug for tenant
        $baseSlug = $validated['slug'];
        $count = 1;
        while (Category::where('slug', $validated['slug'])->exists()) {
            $validated['slug'] = "{$baseSlug}-{$count}";
            $count++;
        }

        $category = Category::create([
            'name' => $validated['name'],
            'slug' => $validated['slug'],
            'icon' => $validated['icon'] ?? 'tag',
            'description' => $validated['description'] ?? null,
            'has_serials' => $validated['has_serials'] ?? true,
            'spec_fields' => $validated['spec_fields'] ?? null,
            'sort_order' => $validated['sort_order'] ?? 0,
            'is_active' => true,
        ]);

        AuditLog::record(
            action: 'category_created',
            entityType: 'Category',
            entityId: (string) $category->id,
            newValues: ['name' => $category->name, 'has_serials' => $category->has_serials]
        );

        return response()->json([
            'success' => true,
            'message' => "Category '{$category->name}' created successfully.",
            'data' => $category->loadCount('products'),
        ], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Category management is restricted to store owners/administrators.',
            ], 403);
        }

        $category = Category::findOrFail($id);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:100'],
            'icon' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string'],
            'has_serials' => ['boolean'],
            'spec_fields' => ['nullable', 'array'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['boolean'],
        ]);

        $category->update($validated);

        AuditLog::record(
            action: 'category_updated',
            entityType: 'Category',
            entityId: (string) $category->id,
            newValues: $validated
        );

        return response()->json([
            'success' => true,
            'message' => "Category '{$category->name}' updated successfully.",
            'data' => $category->loadCount('products'),
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Category management is restricted to store owners/administrators.',
            ], 403);
        }

        $category = Category::withCount('products')->findOrFail($id);

        if ($category->products_count > 0) {
            return response()->json([
                'success' => false,
                'message' => "Cannot delete category '{$category->name}' because it contains {$category->products_count} product(s). Please reassign or delete them first.",
            ], 422);
        }

        $categoryName = $category->name;
        $category->delete();

        AuditLog::record(
            action: 'category_deleted',
            entityType: 'Category',
            entityId: (string) $id,
            oldValues: ['name' => $categoryName]
        );

        return response()->json([
            'success' => true,
            'message' => "Category '{$categoryName}' deleted successfully.",
        ]);
    }
}
