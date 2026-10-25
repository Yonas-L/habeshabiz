<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Contact;
use App\Models\Debt;
use App\Models\SalesOrder;
use App\Models\User;
use App\Scopes\TenantScope;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class StaffController extends Controller
{
    /**
     * List all staff members with their sales stats.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $currentUser->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Only business owners can access staff management.',
            ], 403);
        }

        $staffMembers = User::where('tenant_id', $currentUser->tenant_id)
            ->where('role', 'salesperson')
            ->orderBy('name')
            ->get();

        $startOfWeek = Carbon::now()->startOfWeek();
        $startOfMonth = Carbon::now()->startOfMonth();

        $enriched = $staffMembers->map(function ($staff) use ($startOfWeek, $startOfMonth) {
            $weekOrders = SalesOrder::where('salesperson_id', $staff->id)
                ->where('created_at', '>=', $startOfWeek)
                ->get();

            $monthOrders = SalesOrder::where('salesperson_id', $staff->id)
                ->where('created_at', '>=', $startOfMonth)
                ->get();

            $lastSale = SalesOrder::where('salesperson_id', $staff->id)
                ->latest()
                ->first();

            return [
                'id' => $staff->id,
                'name' => $staff->name,
                'email' => $staff->email,
                'phone' => $staff->phone,
                'role' => $staff->role,
                'is_active' => $staff->is_active,
                'permissions' => $staff->permissions,
                'created_at' => $staff->created_at,
                'stats' => [
                    'sales_count_week' => $weekOrders->count(),
                    'sales_volume_week' => (float) $weekOrders->sum('total_amount'),
                    'sales_count_month' => $monthOrders->count(),
                    'sales_volume_month' => (float) $monthOrders->sum('total_amount'),
                    'uncollected_bonus' => (float) Debt::where('salesperson_id', $staff->id)
                        ->where('reference_type', 'salesperson_bonus')
                        ->whereIn('status', ['open', 'partially_paid'])
                        ->sum('remaining_amount'),
                    'collected_bonus' => (float) Debt::where('salesperson_id', $staff->id)
                        ->where('reference_type', 'salesperson_bonus')
                        ->sum('paid_amount'),
                    'total_bonus_earned' => (float) Debt::where('salesperson_id', $staff->id)
                        ->where('reference_type', 'salesperson_bonus')
                        ->sum('original_amount'),
                    'last_sale_at' => $lastSale?->order_date ?? $lastSale?->created_at,
                ],
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $enriched,
        ]);
    }

    /**
     * Create a new staff member with an auto-generated temporary password.
     */
    public function store(Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $currentUser->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Only business owners can add staff members.',
            ], 403);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'phone' => ['required', 'string', 'max:25'],
            'email' => ['nullable', 'email', 'max:100'],
            'can_discount' => ['nullable', 'boolean'],
            'can_handover' => ['nullable', 'boolean'],
            'can_intake_stock' => ['nullable', 'boolean'],
            'can_view_costs' => ['nullable', 'boolean'],
            'can_manage_inventory' => ['nullable', 'boolean'],
        ]);

        $tenantId = $currentUser->tenant_id ?? TenantScope::getActiveTenantId();

        // Validate phone uniqueness for staff in this shop/system
        $cleanPhone = preg_replace('/[^0-9]/', '', $validated['phone']);
        $last9 = strlen($cleanPhone) >= 9 ? substr($cleanPhone, -9) : $cleanPhone;

        $phoneExists = User::where('tenant_id', $tenantId)
            ->where(function ($q) use ($validated, $last9) {
                $q->where('phone', $validated['phone']);
                if (! empty($last9)) {
                    $q->orWhere('phone', 'like', "%{$last9}");
                }
            })
            ->exists();

        if ($phoneExists) {
            return response()->json([
                'message' => 'A staff member with this phone number already exists in your shop.',
                'errors' => [
                    'phone' => ['A staff member with this phone number already exists in your shop.'],
                ],
            ], 422);
        }

        // Generate default email if omitted: name@mail.com
        $email = $validated['email'] ?? null;
        if (! $email) {
            $firstName = explode(' ', trim($validated['name']))[0];
            $cleanName = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $firstName));
            if (empty($cleanName)) {
                $cleanName = 'staff';
            }
            $baseEmail = "{$cleanName}@mail.com";
            $email = $baseEmail;
            $counter = 1;
            while (User::where('email', $email)->exists()) {
                $email = "{$cleanName}{$counter}@mail.com";
                $counter++;
            }
        }

        // Default password for salesperson staff registration
        $tempPassword = '434344#Pass';

        $user = User::create([
            'tenant_id' => $tenantId,
            'name' => $validated['name'],
            'phone' => $validated['phone'],
            'email' => $email,
            'password' => Hash::make($tempPassword),
            'role' => 'salesperson',
            'permissions' => [
                'can_view_costs' => $request->boolean('can_view_costs', false),
                'can_discount' => $request->boolean('can_discount', false),
                'can_handover' => $request->boolean('can_handover', false),
                'can_intake_stock' => $request->boolean('can_intake_stock', false),
                'can_manage_inventory' => $request->boolean('can_manage_inventory', false),
            ],
            'is_active' => true,
        ]);

        // Safely sync staff contact in contacts table
        $cleanPhone = preg_replace('/[^0-9]/', '', $validated['phone']);
        $last9 = strlen($cleanPhone) >= 9 ? substr($cleanPhone, -9) : $cleanPhone;
        $staffContact = Contact::where('tenant_id', $tenantId)
            ->where(function ($q) use ($validated, $last9) {
                $q->where('phone', $validated['phone']);
                if (! empty($last9)) {
                    $q->orWhere('phone', 'like', "%{$last9}");
                }
            })
            ->first();

        if (! $staffContact) {
            $staffContact = Contact::where('tenant_id', $tenantId)
                ->where('name', $validated['name'])
                ->first();
        }

        if ($staffContact) {
            $existingRoles = is_array($staffContact->roles) ? $staffContact->roles : [];
            $newRoles = array_values(array_unique(array_merge($existingRoles, ['staff', 'salesperson'])));
            $staffContact->roles = $newRoles;
            if ($staffContact->name !== $validated['name']) {
                $staffContact->name = $validated['name'];
            }
            if ($email && empty($staffContact->email)) {
                $staffContact->email = $email;
            }
            $staffContact->save();
        } else {
            $phoneToUse = $validated['phone'];
            if (Contact::where('tenant_id', $tenantId)->where('phone', $phoneToUse)->exists()) {
                $phoneToUse = null;
            }
            Contact::create([
                'tenant_id' => $tenantId,
                'name' => $validated['name'],
                'phone' => $phoneToUse,
                'email' => $email,
                'roles' => ['staff', 'salesperson'],
                'is_active' => true,
            ]);
        }

        AuditLog::record(
            action: 'staff_created',
            entityType: 'User',
            entityId: (string) $user->id,
            newValues: [
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'permissions' => $user->permissions,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => "Staff member {$user->name} created successfully.",
            'data' => [
                'user' => $user,
                'temporary_password' => $tempPassword,
            ],
        ], 201);
    }

    /**
     * Update an existing staff member's details and granular permissions.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $currentUser->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Only business owners can update staff members.',
            ], 403);
        }

        if ($currentUser->id === $id) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot modify your own administrator permissions here.',
            ], 422);
        }

        $staff = User::where('tenant_id', $currentUser->tenant_id)->findOrFail($id);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'phone' => ['required', 'string', 'max:25'],
            'email' => ['nullable', 'email', 'max:100', 'unique:users,email,'.$staff->id],
            'can_discount' => ['nullable', 'boolean'],
            'can_handover' => ['nullable', 'boolean'],
            'can_intake_stock' => ['nullable', 'boolean'],
            'can_view_costs' => ['nullable', 'boolean'],
            'can_manage_inventory' => ['nullable', 'boolean'],
        ]);

        // Validate phone uniqueness excluding current staff
        $cleanPhone = preg_replace('/[^0-9]/', '', $validated['phone']);
        $last9 = strlen($cleanPhone) >= 9 ? substr($cleanPhone, -9) : $cleanPhone;

        $phoneExists = User::where('tenant_id', $currentUser->tenant_id)
            ->where('id', '!=', $staff->id)
            ->where(function ($q) use ($validated, $last9) {
                $q->where('phone', $validated['phone']);
                if (! empty($last9)) {
                    $q->orWhere('phone', 'like', "%{$last9}");
                }
            })
            ->exists();

        if ($phoneExists) {
            return response()->json([
                'message' => 'A staff member with this phone number already exists in your shop.',
                'errors' => [
                    'phone' => ['A staff member with this phone number already exists in your shop.'],
                ],
            ], 422);
        }

        $currentPermissions = is_array($staff->permissions) ? $staff->permissions : [];
        $newPermissions = array_merge($currentPermissions, [
            'can_discount' => $request->boolean('can_discount', false),
            'can_handover' => $request->boolean('can_handover', false),
            'can_intake_stock' => $request->boolean('can_intake_stock', false),
            'can_view_costs' => $request->boolean('can_view_costs', false),
            'can_manage_inventory' => $request->boolean('can_manage_inventory', false),
        ]);

        $updateData = [
            'name' => $validated['name'],
            'phone' => $validated['phone'],
            'permissions' => $newPermissions,
        ];

        if (array_key_exists('email', $validated) && ! empty($validated['email'])) {
            $updateData['email'] = $validated['email'];
        }

        $staff->update($updateData);

        AuditLog::record(
            action: 'staff_updated',
            entityType: 'User',
            entityId: (string) $staff->id,
            newValues: [
                'name' => $staff->name,
                'phone' => $staff->phone,
                'email' => $staff->email,
                'permissions' => $newPermissions,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => "Staff member {$staff->name} updated successfully.",
            'data' => $staff,
        ]);
    }

    /**
     * Remove a staff account from the system while preserving historical sales and financial data.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $currentUser->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Only business owners can remove staff accounts.',
            ], 403);
        }

        if ($currentUser->id === $id) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot remove your own business owner account.',
            ], 422);
        }

        $staff = User::where('tenant_id', $currentUser->tenant_id)->findOrFail($id);

        $staffName = $staff->name;
        $staffPhone = $staff->phone;
        $staffEmail = $staff->email;

        // Revoke active login tokens
        $staff->tokens()->delete();

        // Soft delete the user so historical records (sales, bonuses, debts, audits) remain intact
        $staff->delete();

        AuditLog::record(
            action: 'staff_removed',
            entityType: 'User',
            entityId: (string) $staff->id,
            oldValues: [
                'name' => $staffName,
                'phone' => $staffPhone,
                'email' => $staffEmail,
                'removed_by' => $currentUser->name,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => "Staff member {$staffName} has been removed from the system.",
        ]);
    }

    /**
     * Toggle active/disabled status of a staff member.
     */
    public function toggleStatus(Request $request, int $id): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $currentUser->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Only business owners can change staff access.',
            ], 403);
        }

        if ($currentUser->id === $id) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot modify your own administrator account status.',
            ], 422);
        }

        $staff = User::where('tenant_id', $currentUser->tenant_id)->findOrFail($id);
        $newStatus = ! $staff->is_active;
        $staff->update(['is_active' => $newStatus]);

        AuditLog::record(
            action: $newStatus ? 'staff_activated' : 'staff_suspended',
            entityType: 'User',
            entityId: (string) $staff->id,
            newValues: ['is_active' => $newStatus]
        );

        return response()->json([
            'success' => true,
            'message' => 'Staff access updated to '.($newStatus ? 'Active' : 'Suspended'),
            'data' => $staff,
        ]);
    }

    /**
     * Reset password for staff member with default password.
     */
    public function resetPassword(Request $request, int $id): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $currentUser->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Only business owners can reset staff passwords.',
            ], 403);
        }

        $staff = User::where('tenant_id', $currentUser->tenant_id)->findOrFail($id);
        $tempPassword = '434344#Pass';
        $staff->update(['password' => Hash::make($tempPassword)]);

        AuditLog::record(
            action: 'staff_password_reset',
            entityType: 'User',
            entityId: (string) $staff->id,
            newValues: ['reset_by' => $currentUser->name]
        );

        return response()->json([
            'success' => true,
            'message' => "Password reset for {$staff->name}.",
            'data' => [
                'temporary_password' => $tempPassword,
            ],
        ]);
    }

    /**
     * Sales Leaderboard: Healthy friendly competition among sales workers.
     * Accessible to both Owner and Salespeople.
     */
    public function leaderboard(Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();

        $monthParam = $request->query('month');
        $isMonthlyFilter = false;
        if ($monthParam && preg_match('/^\d{4}-\d{2}$/', $monthParam)) {
            $startOfMonth = Carbon::createFromFormat('Y-m', $monthParam)->startOfMonth();
            $endOfMonth = $startOfMonth->copy()->endOfMonth();
            $isMonthlyFilter = true;
        } else {
            $startOfMonth = Carbon::now()->startOfMonth();
            $endOfMonth = Carbon::now()->endOfMonth();
        }

        $startOfWeek = Carbon::now()->startOfWeek();

        $staffMembers = User::where('tenant_id', $currentUser->tenant_id)
            ->where('role', 'salesperson')
            ->where('is_active', true)
            ->get();

        $rankings = $staffMembers->map(function ($staff) use ($startOfWeek, $startOfMonth, $endOfMonth) {
            $weekOrders = SalesOrder::where('salesperson_id', $staff->id)
                ->where('created_at', '>=', $startOfWeek)
                ->get();

            $monthOrders = SalesOrder::where('salesperson_id', $staff->id)
                ->whereBetween('order_date', [$startOfMonth, $endOfMonth])
                ->get();

            $weekVolume = (float) $weekOrders->sum('total_amount');
            $monthVolume = (float) $monthOrders->sum('total_amount');

            // Compute bonus unlocked based on volume milestones
            $bonusTier = 'Starter';
            $bonusAmount = 0;
            if ($monthVolume >= 500000) {
                $bonusTier = 'Gold Champion';
                $bonusAmount = 5000;
            } elseif ($monthVolume >= 250000) {
                $bonusTier = 'Silver Achiever';
                $bonusAmount = 2500;
            } elseif ($monthVolume >= 100000) {
                $bonusTier = 'Bronze Performer';
                $bonusAmount = 1000;
            }

            $bonusDebts = Debt::where('salesperson_id', $staff->id)
                ->where('reference_type', 'salesperson_bonus')
                ->where('created_at', '<=', $endOfMonth)
                ->get();

            $uncollectedBonus = (float) $bonusDebts->whereIn('status', ['open', 'partially_paid'])->sum('remaining_amount');
            $collectedBonus = (float) $bonusDebts->sum('paid_amount');
            $totalBonusEarned = (float) $bonusDebts->sum('original_amount');

            return [
                'user_id' => $staff->id,
                'name' => $staff->name,
                'email' => $staff->email,
                'week_count' => $weekOrders->count(),
                'week_volume' => $weekVolume,
                'month_count' => $monthOrders->count(),
                'month_volume' => $monthVolume,
                'bonus_tier' => $bonusTier,
                'bonus_amount' => $bonusAmount,
                'uncollected_bonus' => $uncollectedBonus,
                'collected_bonus' => $collectedBonus,
                'total_bonus_earned' => $totalBonusEarned,
            ];
        });

        $sorted = $isMonthlyFilter
            ? $rankings->sortByDesc('month_volume')->values()
            : $rankings->sortByDesc('week_volume')->values();

        // Assign ranks
        $ranked = $sorted->map(function ($item, $idx) {
            $item['rank'] = $idx + 1;

            return $item;
        });

        return response()->json([
            'success' => true,
            'data' => [
                'leaderboard' => $ranked,
                'top_seller' => $ranked->first() ?? null,
            ],
        ]);
    }

    /**
     * Live Audit Feed for the owner.
     */
    public function auditLogs(Request $request): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();
        if (! $currentUser->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Only business owners can view audit logs.',
            ], 403);
        }

        $logs = AuditLog::with('user')
            ->latest('created_at')
            ->take(50)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $logs,
        ]);
    }
}
