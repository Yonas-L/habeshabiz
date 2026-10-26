<?php

namespace App\Http\Controllers\Api;

use App\Actions\SettleDebtPaymentAction;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Contact;
use App\Models\Debt;
use App\Models\InventoryUnit;
use App\Models\SalesOrder;
use App\Models\User;
use App\Scopes\TenantScope;
use App\Services\PdfGeneratorService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Response;

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

        $activeHandovers = InventoryUnit::where('status', 'out')
            ->whereNotNull('handover_to')
            ->get();

        $staffContacts = Contact::where('tenant_id', $currentUser->tenant_id)
            ->where(function ($q) use ($staffMembers) {
                $q->whereIn('name', $staffMembers->pluck('name'))
                    ->orWhereIn('phone', $staffMembers->pluck('phone')->filter());
            })
            ->get();

        $enriched = $staffMembers->map(function ($staff) use ($startOfWeek, $startOfMonth, $activeHandovers, $staffContacts) {
            $weekOrders = SalesOrder::where('salesperson_id', $staff->id)
                ->where('created_at', '>=', $startOfWeek)
                ->get();

            $monthOrders = SalesOrder::where('salesperson_id', $staff->id)
                ->where('created_at', '>=', $startOfMonth)
                ->get();

            $lastSale = SalesOrder::where('salesperson_id', $staff->id)
                ->latest()
                ->first();

            $staffHandovers = $activeHandovers->filter(function ($u) use ($staff) {
                return $u->handover_to === $staff->name;
            });
            $activeHandoversCount = $staffHandovers->count();
            $activeHandoversValue = (float) $staffHandovers->sum(function ($u) {
                return (float) ($u->handover_payout ?: ($u->selling_price ?: ($u->cost_basis ?: 0)));
            });

            $contact = $staffContacts->first(fn ($c) => ($staff->phone && $c->phone === $staff->phone) || strcasecmp($c->name, $staff->name) === 0);
            $openReceivable = $contact ? (float) $contact->open_receivable : $activeHandoversValue;

            return [
                'id' => $staff->id,
                'name' => $staff->name,
                'email' => $staff->email,
                'phone' => $staff->phone,
                'role' => $staff->role,
                'is_active' => $staff->is_active,
                'contact_id' => $contact?->id,
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
                    'active_handovers_count' => $activeHandoversCount,
                    'active_handovers_value' => $activeHandoversValue,
                    'open_receivable' => max($openReceivable, $activeHandoversValue),
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

    /**
     * Comprehensive statement of activity, commission bonus ledger, sales, and handovers for a staff member.
     */
    public function statement(Request $request, int $id): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();

        if (! $currentUser->isOwner() && $currentUser->id !== $id) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to view this staff statement.',
            ], 403);
        }

        $staff = User::where('tenant_id', $currentUser->tenant_id)->findOrFail($id);

        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');

        // Query bonus debts
        $bonusQuery = Debt::where('tenant_id', $currentUser->tenant_id)
            ->where('salesperson_id', $staff->id)
            ->where('reference_type', 'salesperson_bonus')
            ->with(['payments.financialAccount', 'salesOrder.items.variant.product', 'salesOrder.customer']);

        if ($startDate) {
            $bonusQuery->where('created_at', '>=', Carbon::parse($startDate)->startOfDay());
        }
        if ($endDate) {
            $bonusQuery->where('created_at', '<=', Carbon::parse($endDate)->endOfDay());
        }

        $bonusDebts = $bonusQuery->orderByDesc('created_at')->get();

        // Query sales orders
        $salesQuery = SalesOrder::where('tenant_id', $currentUser->tenant_id)
            ->where('salesperson_id', $staff->id)
            ->with(['customer', 'items.variant.product']);

        if ($startDate) {
            $salesQuery->where('created_at', '>=', Carbon::parse($startDate)->startOfDay());
        }
        if ($endDate) {
            $salesQuery->where('created_at', '<=', Carbon::parse($endDate)->endOfDay());
        }

        $salesOrders = $salesQuery->orderByDesc('created_at')->get();

        // Query handovers (devices out with this specific staff member, strict case-sensitive name match)
        $handoversQuery = InventoryUnit::where('tenant_id', $currentUser->tenant_id)
            ->where('handover_to', '=', $staff->name)
            ->with(['variant.product']);

        if ($startDate) {
            $handoversQuery->where('handed_out_at', '>=', Carbon::parse($startDate)->startOfDay());
        }
        if ($endDate) {
            $handoversQuery->where('handed_out_at', '<=', Carbon::parse($endDate)->endOfDay());
        }

        $handovers = $handoversQuery->orderByDesc('handed_out_at')->get();

        // All-time totals
        $allBonusDebts = Debt::where('tenant_id', $currentUser->tenant_id)
            ->where('salesperson_id', $staff->id)
            ->where('reference_type', 'salesperson_bonus')
            ->get();

        $uncollectedBonus = (float) $allBonusDebts->whereIn('status', ['open', 'partially_paid'])->sum('remaining_amount');
        $collectedBonus = (float) $allBonusDebts->sum('paid_amount');
        $totalBonusEarned = (float) $allBonusDebts->sum('original_amount');

        $activeHandovers = $handovers->where('status', 'out');
        $activeHandoversCount = $activeHandovers->count();
        $activeHandoversValue = (float) $activeHandovers->sum(function ($u) {
            return (float) ($u->handover_payout ?: ($u->selling_price ?: ($u->cost_basis ?: 0)));
        });

        // Format bonus ledger entries (strictly labeled 'Bonus', not 'Payable')
        $bonusLedger = $bonusDebts->map(function ($debt) {
            $order = $debt->salesOrder;
            $itemsDesc = 'Product Sale';
            if ($order && $order->items->isNotEmpty()) {
                $itemsDesc = $order->items->map(function ($it) {
                    $name = $it->variant?->product?->name ?? 'Device';
                    $sn = $it->inventoryUnit?->imei_or_serial ? " ({$it->inventoryUnit->imei_or_serial})" : '';

                    return "{$name}{$sn}";
                })->join(', ');
            }

            return [
                'id' => $debt->id,
                'date' => $debt->created_at?->toIso8601String(),
                'order_id' => $order?->id,
                'order_number' => $order?->order_number,
                'description' => "Commission Bonus · {$itemsDesc}",
                'type' => 'bonus',
                'type_label' => 'Bonus',
                'bonus_amount' => (float) $debt->original_amount,
                'paid_amount' => (float) $debt->paid_amount,
                'remaining_amount' => (float) $debt->remaining_amount,
                'status' => $debt->status,
                'due_date' => $debt->due_date?->toDateString(),
                'notes' => $debt->notes,
                'payments' => $debt->payments->map(fn ($p) => [
                    'id' => $p->id,
                    'amount' => (float) $p->amount,
                    'payment_date' => $p->payment_date?->toIso8601String(),
                    'account_name' => $p->financialAccount?->name,
                    'reference_number' => $p->reference_number,
                    'notes' => $p->notes,
                ]),
            ];
        });

        // Format sales orders
        $formattedSales = $salesOrders->map(function ($order) {
            return [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'order_date' => $order->order_date?->toIso8601String() ?? $order->created_at?->toIso8601String(),
                'customer_name' => $order->customer?->name ?? 'Walk-in Customer',
                'total_amount' => (float) $order->total_amount,
                'paid_amount' => (float) $order->paid_amount,
                'payment_status' => $order->payment_status,
                'bonus_amount' => (float) ($order->total_bonus_amount ?? 0),
                'items_count' => $order->items->count(),
                'items' => $order->items->map(fn ($it) => [
                    'name' => $it->variant?->product?->name ?? 'Device',
                    'imei' => $it->inventoryUnit?->imei_or_serial,
                    'unit_price' => (float) $it->unit_price,
                ]),
            ];
        });

        // Format handovers
        $formattedHandovers = $handovers->map(function ($unit) {
            return [
                'id' => $unit->id,
                'device_name' => $unit->variant?->product?->name ?? 'Device',
                'imei_or_serial' => $unit->imei_or_serial,
                'status' => $unit->status,
                'handed_out_at' => $unit->handed_out_at?->toIso8601String(),
                'sold_at' => $unit->sold_at?->toIso8601String(),
                'location' => $unit->location,
                'handover_payout' => (float) ($unit->handover_payout ?: 0),
                'return_deadline' => $unit->return_deadline?->toDateString(),
                'notes' => $unit->notes,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'staff' => [
                    'id' => $staff->id,
                    'name' => $staff->name,
                    'email' => $staff->email,
                    'phone' => $staff->phone,
                    'role' => $staff->role,
                    'is_active' => $staff->is_active,
                    'created_at' => $staff->created_at?->toIso8601String(),
                ],
                'summary' => [
                    'uncollected_bonus' => $uncollectedBonus,
                    'collected_bonus' => $collectedBonus,
                    'total_bonus_earned' => $totalBonusEarned,
                    'total_sales_count' => $salesOrders->count(),
                    'total_sales_volume' => (float) $salesOrders->sum('total_amount'),
                    'active_handovers_count' => $activeHandoversCount,
                    'active_handovers_value' => $activeHandoversValue,
                ],
                'bonus_ledger' => $bonusLedger,
                'sales_orders' => $formattedSales,
                'handovers' => $formattedHandovers,
            ],
        ]);
    }

    /**
     * Settle / Payout a staff member's commission bonus from a chosen treasury account.
     */
    public function settleBonus(Request $request, int $id, SettleDebtPaymentAction $settleAction): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();

        if (! $currentUser->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Only business owners can payout staff bonuses.',
            ], 403);
        }

        $staff = User::where('tenant_id', $currentUser->tenant_id)->findOrFail($id);

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:1'],
            'financial_account_id' => ['required_without:payment_splits', 'nullable', 'exists:financial_accounts,id'],
            'payment_splits' => ['nullable', 'array', 'min:1'],
            'payment_splits.*.financial_account_id' => ['required', 'exists:financial_accounts,id'],
            'payment_splits.*.amount' => ['required', 'numeric', 'min:0.01'],
            'payment_splits.*.reference_number' => ['nullable', 'string', 'max:100'],
            'payment_date' => ['nullable', 'date'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string'],
        ]);

        // Find all open bonus debts for this staff member (FIFO order)
        $openBonusDebts = Debt::where('tenant_id', $currentUser->tenant_id)
            ->where('salesperson_id', $staff->id)
            ->where('reference_type', 'salesperson_bonus')
            ->whereIn('status', ['open', 'partially_paid'])
            ->orderBy('created_at', 'asc')
            ->get();

        $totalOpenBonus = (float) $openBonusDebts->sum('remaining_amount');
        if ($totalOpenBonus <= 0) {
            return response()->json([
                'success' => false,
                'message' => "{$staff->name} has no open commission bonuses to settle.",
            ], 422);
        }

        $paymentAmount = (float) $validated['amount'];
        if ($paymentAmount > $totalOpenBonus + 0.01) {
            return response()->json([
                'success' => false,
                'message' => 'Payment amount ('.number_format($paymentAmount, 2).' ETB) exceeds total open bonus balance ('.number_format($totalOpenBonus, 2).' ETB).',
            ], 422);
        }

        $result = $settleAction->executeWaterfallDebts($openBonusDebts, $validated);
        $createdPayments = $result['payments'];

        return response()->json([
            'success' => true,
            'message' => 'Successfully disbursed '.number_format($validated['amount'], 2)." ETB bonus to {$staff->name}.",
            'data' => [
                'payments' => $createdPayments,
            ],
        ]);
    }

    /**
     * Download or view a crisp, branded Staff Statement PDF.
     */
    public function statementPdf(Request $request, int $id, PdfGeneratorService $pdfService): Response
    {
        /** @var User $currentUser */
        $currentUser = $request->user();

        if (! $currentUser->isOwner() && $currentUser->id !== $id) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized to download this staff statement.',
            ], 403);
        }

        $staff = User::where('tenant_id', $currentUser->tenant_id)->findOrFail($id);
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        $forceDownload = $request->query('download', '1') === '1';

        return $pdfService->generateStaffStatement($staff, $startDate, $endDate, $forceDownload);
    }
}
