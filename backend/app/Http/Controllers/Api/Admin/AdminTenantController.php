<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\InventoryStock;
use App\Models\InventoryUnit;
use App\Models\Product;
use App\Models\SalesOrder;
use App\Models\Tenant;
use App\Models\User;
use App\Services\TenantOnboardingService;
use App\Support\DeviceDetector;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class AdminTenantController extends Controller
{
    public function __construct(
        protected TenantOnboardingService $onboardingService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));
        $status = (string) $request->query('status', 'all');

        $query = Tenant::query()
            ->with([
                'users' => function ($q) {
                    $q->select(['id', 'tenant_id', 'name', 'email', 'phone', 'role', 'is_active', 'last_device', 'last_device_type', 'last_browser', 'last_login_at', 'last_login_ip']);
                },
            ])
            ->withCount([
                'users',
                'products',
                'salesOrders as sales_count',
                'inventoryUnits as in_stock_units_count' => function ($q) {
                    $q->where('status', 'in_stock');
                },
            ])
            ->withSum('salesOrders as sales_volume', 'total_amount');

        if ($status === 'active') {
            $query->where('is_locked', false);
        } elseif ($status === 'locked') {
            $query->where('is_locked', true);
        }

        if (!empty($search)) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                    ->orWhere('slug', 'ilike', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhereHas('users', function ($uq) use ($search) {
                        $uq->where('email', 'ilike', "%{$search}%")
                            ->orWhere('name', 'ilike', "%{$search}%")
                            ->orWhere('phone', 'like', "%{$search}%");
                    });
            });
        }

        $tenants = $query->orderByDesc('created_at')->paginate(20);

        $tenantIds = $tenants->getCollection()->pluck('id')->toArray();

        // Get max audit logs and sales per tenant for activity tracking
        $auditMax = AuditLog::whereIn('tenant_id', $tenantIds)
            ->groupBy('tenant_id')
            ->selectRaw('tenant_id, MAX(created_at) as max_at')
            ->pluck('max_at', 'tenant_id');

        $salesMax = SalesOrder::whereIn('tenant_id', $tenantIds)
            ->groupBy('tenant_id')
            ->selectRaw('tenant_id, MAX(created_at) as max_at')
            ->pluck('max_at', 'tenant_id');

        $inventoryStockSum = InventoryStock::whereIn('tenant_id', $tenantIds)
            ->groupBy('tenant_id')
            ->selectRaw('tenant_id, SUM(quantity_on_hand) as sum_qty')
            ->pluck('sum_qty', 'tenant_id');

        $items = $tenants->getCollection()->map(function (Tenant $tenant) use ($auditMax, $salesMax, $inventoryStockSum): array {
            $owner = $tenant->users->firstWhere('role', 'owner') ?? $tenant->users->first();
            $lastAudit = $auditMax[$tenant->id] ?? null;
            $lastSale = $salesMax[$tenant->id] ?? null;

            $auditTimestamp = $lastAudit ? strtotime((string) $lastAudit) : 0;
            $saleTimestamp = $lastSale ? strtotime((string) $lastSale) : 0;
            $createdTimestamp = strtotime((string) $tenant->created_at);

            $latestTimestamp = max($auditTimestamp, $saleTimestamp, $createdTimestamp);
            $lastActivityAt = date('c', $latestTimestamp);

            $serializedStock = (int) ($tenant->in_stock_units_count ?? 0);
            $accessoryStock = (int) ($inventoryStockSum[$tenant->id] ?? 0);
            $totalStock = $serializedStock + $accessoryStock;

            $mostRecentUser = $tenant->users->sortByDesc('last_login_at')->first() ?? $owner;

            return [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
                'phone' => $tenant->phone,
                'business_type' => $tenant->business_type,
                'currency_code' => $tenant->currency_code ?: 'ETB',
                'created_at' => $tenant->created_at,
                'is_locked' => (bool) $tenant->is_locked,
                'lock_reason' => $tenant->lock_reason,
                'locked_at' => $tenant->locked_at,
                'settings' => $tenant->settings,
                'owner' => $owner ? [
                    'id' => $owner->id,
                    'name' => $owner->name,
                    'email' => $owner->email,
                    'phone' => $owner->phone,
                    'last_device' => $owner->last_device,
                    'last_device_type' => $owner->last_device_type,
                    'last_browser' => $owner->last_browser,
                    'last_login_at' => $owner->last_login_at,
                ] : null,
                'owner_email' => $owner?->email,
                'primary_device' => $mostRecentUser?->last_device ?: $owner?->last_device,
                'primary_device_type' => $mostRecentUser?->last_device_type ?: $owner?->last_device_type,
                'users_count' => (int) ($tenant->users_count ?? 0),
                'products_count' => (int) ($tenant->products_count ?? 0),
                'stock_count' => $totalStock,
                'serialized_stock_count' => $serializedStock,
                'accessory_stock_count' => $accessoryStock,
                'sales_count' => (int) ($tenant->sales_count ?? 0),
                'sales_volume' => (float) ($tenant->sales_volume ?? 0),
                'last_activity_at' => $lastActivityAt,
            ];
        });

        // Top-level platform vital stats
        $summary = [
            'total_tenants' => Tenant::count(),
            'active_tenants' => Tenant::where('is_locked', false)->count(),
            'locked_tenants' => Tenant::where('is_locked', true)->count(),
            'total_stock_count' => (int) (InventoryUnit::where('status', 'in_stock')->count() + (int) InventoryStock::sum('quantity_on_hand')),
            'total_sales_volume' => (float) SalesOrder::sum('total_amount'),
            'total_sales_count' => (int) SalesOrder::count(),
            'total_users' => User::count(),
        ];

        return response()->json([
            'data' => $items,
            'summary' => $summary,
            'pagination' => [
                'current_page' => $tenants->currentPage(),
                'last_page' => $tenants->lastPage(),
                'per_page' => $tenants->perPage(),
                'total' => $tenants->total(),
            ],
        ]);
    }

    public function show(string $id): JsonResponse
    {
        $tenant = Tenant::with([
            'users' => function ($q) {
                $q->select(['id', 'tenant_id', 'name', 'email', 'phone', 'role', 'is_active', 'last_device', 'last_device_type', 'last_browser', 'last_login_ip', 'last_login_at', 'created_at']);
            },
            'financialAccounts' => function ($q) {
                $q->select(['id', 'tenant_id', 'name', 'type', 'currency', 'current_balance', 'is_active', 'default_fee_type', 'default_fee_amount', 'logo']);
            },
        ])->findOrFail($id);

        $owner = $tenant->users->firstWhere('role', 'owner') ?? $tenant->users->first();

        // Inventory breakdown
        $totalProducts = Product::where('tenant_id', $tenant->id)->count();
        $inStockUnits = InventoryUnit::where('tenant_id', $tenant->id)->where('status', 'in_stock')->count();
        $soldUnits = InventoryUnit::where('tenant_id', $tenant->id)->where('status', 'sold')->count();
        $inventoryValuation = (float) InventoryUnit::where('tenant_id', $tenant->id)->where('status', 'in_stock')->sum('cost_basis');
        $accessoriesQty = (int) InventoryStock::where('tenant_id', $tenant->id)->sum('quantity_on_hand');

        // Sales breakdown
        $totalSalesCount = SalesOrder::where('tenant_id', $tenant->id)->count();
        $totalSalesVolume = (float) SalesOrder::where('tenant_id', $tenant->id)->sum('total_amount');
        $recentOrders = SalesOrder::with('customer:id,name')
            ->where('tenant_id', $tenant->id)
            ->orderByDesc('created_at')
            ->limit(5)
            ->select(['id', 'tenant_id', 'order_number', 'customer_id', 'total_amount', 'payment_status', 'payment_method', 'created_at'])
            ->get();

        // Audit activity logs
        $recentActivity = AuditLog::with('user:id,name,email,last_device')
            ->where('tenant_id', $tenant->id)
            ->orderByDesc('created_at')
            ->limit(30)
            ->get()
            ->map(function ($log) {
                $item = $log->toArray();
                $item['device_info'] = $log->user_agent ? DeviceDetector::parse($log->user_agent) : null;
                return $item;
            });

        return response()->json([
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
                'phone' => $tenant->phone,
                'business_type' => $tenant->business_type,
                'currency_code' => $tenant->currency_code ?: 'ETB',
                'created_at' => $tenant->created_at,
                'settings' => $tenant->settings,
                'is_locked' => (bool) $tenant->is_locked,
                'lock_reason' => $tenant->lock_reason,
                'locked_at' => $tenant->locked_at,
                'owner' => $owner ? [
                    'id' => $owner->id,
                    'name' => $owner->name,
                    'email' => $owner->email,
                    'phone' => $owner->phone,
                    'last_device' => $owner->last_device,
                    'last_device_type' => $owner->last_device_type,
                    'last_browser' => $owner->last_browser,
                    'last_login_at' => $owner->last_login_at,
                ] : null,
            ],
            'users' => $tenant->users,
            'financial_accounts' => $tenant->financialAccounts,
            'inventory' => [
                'total_products' => $totalProducts,
                'in_stock_units' => $inStockUnits,
                'sold_units' => $soldUnits,
                'accessories_qty' => $accessoriesQty,
                'total_stock_count' => $inStockUnits + $accessoriesQty,
                'inventory_valuation_etb' => $inventoryValuation,
            ],
            'sales' => [
                'total_sales_count' => $totalSalesCount,
                'total_sales_volume' => $totalSalesVolume,
                'recent_orders' => $recentOrders,
            ],
            'recent_activity' => $recentActivity,
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

    public function resetData(string $id): JsonResponse
    {
        $tenant = Tenant::with('users')->findOrFail($id);

        $this->onboardingService->resetTenantData($tenant);

        return response()->json([
            'message' => "All transactional and inventory data for store '{$tenant->name}' has been reset successfully. Login accounts preserved.",
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
            ],
        ]);
    }

    public function destroy(string $id): JsonResponse
    {
        $tenant = Tenant::findOrFail($id);
        $name = $tenant->name;

        $this->onboardingService->deleteTenantCompletely($tenant);

        return response()->json([
            'message' => "Store '{$name}' and all associated users, inventory, and records have been permanently deleted.",
        ]);
    }
}

