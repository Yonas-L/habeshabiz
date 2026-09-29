<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class AdminTenantController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tenants = Tenant::query()
            ->with(['users' => function ($query) {
                $query->where('role', 'owner')->select(['id', 'tenant_id', 'email']);
            }])
            ->orderByDesc('created_at')
            ->paginate(20);

        $items = $tenants->getCollection()->map(function (Tenant $tenant): array {
            $owner = $tenant->users->first();

            return [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
                'owner_email' => $owner?->email,
                'business_type' => $tenant->business_type,
                'created_at' => $tenant->created_at,
                'is_locked' => (bool) $tenant->is_locked,
                'lock_reason' => $tenant->lock_reason,
                'locked_at' => $tenant->locked_at,
            ];
        });

        return response()->json([
            'data' => $items,
            'pagination' => [
                'current_page' => $tenants->currentPage(),
                'last_page' => $tenants->lastPage(),
                'per_page' => $tenants->perPage(),
                'total' => $tenants->total(),
            ],
        ]);
    }

    public function lock(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $tenant = Tenant::findOrFail($id);

        $tenant->update([
            'is_locked' => true,
            'lock_reason' => $validated['reason'],
            'locked_at' => now(),
        ]);

        Cache::forget("tenant_locked:{$tenant->id}");

        return response()->json([
            'message' => 'Tenant locked successfully.',
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'is_locked' => true,
                'lock_reason' => $tenant->lock_reason,
                'locked_at' => $tenant->locked_at,
            ],
        ]);
    }

    public function unlock(string $id): JsonResponse
    {
        $tenant = Tenant::findOrFail($id);

        $tenant->update([
            'is_locked' => false,
            'lock_reason' => null,
            'locked_at' => null,
        ]);

        Cache::forget("tenant_locked:{$tenant->id}");

        return response()->json([
            'message' => 'Tenant unlocked successfully.',
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'is_locked' => false,
                'lock_reason' => null,
                'locked_at' => null,
            ],
        ]);
    }
}
