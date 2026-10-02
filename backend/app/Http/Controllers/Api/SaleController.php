<?php

namespace App\Http\Controllers\Api;

use App\Actions\RecordSaleAction;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use App\Models\SalesOrder;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SaleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = SalesOrder::with([
            'customer',
            'salesperson',
            'financialAccount',
            'exchangeUnit.variant.product',
            'items.variant.product',
            'items.inventoryUnit.variant.product',
            'items.inventoryUnit.swappedFromUnit.variant.product',
            'items.inventoryUnit.swappedReplacementUnit.variant.product',
            'items.inventoryUnit.swappedSalesOrder',
            'items.vendorContact',
        ]);

        /** @var User|null $user */
        $user = $request->user();
        $isOwner = $user ? $user->isOwner() : false;
        $canViewCost = $user ? ($user->isOwner() || $user->canViewCosts()) : false;

        // Salespeople only see what they sold unless they have store inventory/return management privileges
        if (! $isOwner && $user && ! $user->canManageInventory()) {
            $query->where('salesperson_id', $user->id);
        }

        if ($request->filled('payment_status')) {
            $paymentStatus = $request->payment_status;
            if ($paymentStatus === 'credit' || $paymentStatus === 'unpaid') {
                $query->whereIn('payment_status', ['unpaid', 'partially_paid']);
            } else {
                $query->where('payment_status', $paymentStatus);
            }
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('order_number', 'ilike', "%{$search}%")
                    ->orWhereHas('customer', fn ($cq) => $cq->where('name', 'ilike', "%{$search}%"))
                    ->orWhereHas('items.inventoryUnit', fn ($iq) => $iq->where('imei_or_serial', 'ilike', "%{$search}%"))
                    ->orWhereHas('items.variant.product', fn ($pq) => $pq->where('name', 'ilike', "%{$search}%"))
                    ->orWhereHas('exchangeUnit', fn ($eq) => $eq->where('imei_or_serial', 'ilike', "%{$search}%"));
            });
        }

        if ($request->filled('source_type')) {
            if ($request->source_type === 'exchange') {
                $query->where(function ($q) {
                    $q->whereNotNull('exchange_unit_id')
                        ->orWhere('exchange_allowance', '>', 0)
                        ->orWhereHas('items.inventoryUnit', fn ($iq) => $iq->where('source_type', 'exchange')->orWhereNotNull('exchange_sales_order_id'));
                });
            } elseif ($request->source_type === 'brokered') {
                $query->whereHas('items', fn ($iq) => $iq->where('sourcing_type', 'brokered_neighbour'));
            }
        }

        // Base counts query scoped to user role permissions
        $countsQuery = SalesOrder::query();
        if (! $isOwner && $user && ! $user->canManageInventory()) {
            $countsQuery->where('salesperson_id', $user->id);
        }

        $counts = [
            'all' => (clone $countsQuery)->count(),
            'paid' => (clone $countsQuery)->where('payment_status', 'paid')->count(),
            'credit' => (clone $countsQuery)->whereIn('payment_status', ['unpaid', 'partially_paid'])->count(),
            'exchange' => (clone $countsQuery)->where(function ($q) {
                $q->whereNotNull('exchange_unit_id')
                    ->orWhere('exchange_allowance', '>', 0)
                    ->orWhereHas('items.inventoryUnit', fn ($iq) => $iq->where('source_type', 'exchange')->orWhereNotNull('exchange_sales_order_id'));
            })->count(),
        ];

        if ($request->filled('per_page') && $request->per_page !== 'all') {
            $paginated = $query->latest('order_date')->paginate((int) $request->per_page);
            $items = $paginated->getCollection();
            $pagination = [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'total' => $paginated->total(),
            ];
        } else {
            $items = $query->latest('order_date')->get();
            $pagination = [
                'current_page' => 1,
                'last_page' => 1,
                'total' => $items->count(),
            ];
        }

        // Hide profit and unit_cost if not permitted
        if (! $canViewCost) {
            $items->transform(function ($order) {
                foreach ($order->items as $item) {
                    unset($item->unit_cost, $item->profit, $item->vendor_cost);
                }

                return $order;
            });
        }

        return response()->json([
            'success' => true,
            'data' => $items,
            'counts' => $counts,
            'pagination' => $pagination,
        ]);
    }

    public function store(Request $request, RecordSaleAction $action): JsonResponse
    {
        $validated = $request->validate([
            'order_number' => ['nullable', 'string', 'max:50', 'unique:sales_orders,order_number'],
            'customer_id' => ['nullable', 'exists:contacts,id'],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:50'],
            'salesperson_id' => ['nullable', 'exists:users,id'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'paid_amount' => ['required', 'numeric', 'min:0'],
            'payment_method' => ['required', 'string', 'in:cash,telebirr,cbe,bank_transfer,credit'],
            'financial_account_id' => ['nullable', 'exists:financial_accounts,id'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.variant_id' => ['required', 'exists:product_variants,id'],
            'items.*.inventory_unit_id' => ['nullable', 'exists:inventory_units,id'],
            'items.*.quantity' => ['nullable', 'integer', 'min:1'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.setted_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.sourcing_type' => ['nullable', 'string', 'in:internal_stock,brokered_neighbour'],
            'items.*.vendor_contact_id' => ['nullable', 'exists:contacts,id'],
            'items.*.vendor_cost' => ['nullable', 'numeric', 'min:0'],

            // Optional exchange/trade-in device
            'exchange' => ['nullable', 'array'],
            'exchange.variant_id' => ['required_with:exchange', 'exists:product_variants,id'],
            'exchange.trade_in_value' => ['required_with:exchange', 'numeric', 'min:0.01'],
            'exchange.imei_or_serial' => ['nullable', 'string', 'max:100'],
            'exchange.condition' => ['nullable', 'string', 'max:50'],
            'exchange.battery_health' => ['nullable', 'integer', 'min:1', 'max:100'],
            'exchange.cycle_count' => ['nullable', 'integer', 'min:0'],
            'exchange.sim_type' => ['nullable', 'string', 'max:30'],
            'exchange.location' => ['nullable', 'string', 'max:100'],
            'exchange.notes' => ['nullable', 'string', 'max:500'],
        ]);

        /** @var User|null $currentUser */
        $currentUser = $request->user();
        if (empty($validated['salesperson_id']) && $currentUser) {
            $validated['salesperson_id'] = $currentUser->id;
        }

        $order = $action->execute($validated);

        return response()->json([
            'success' => true,
            'message' => 'Sale recorded successfully.',
            'data' => $order,
        ], 201);
    }

    public function collectPayment(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'financial_account_id' => ['required', 'exists:financial_accounts,id'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $order = SalesOrder::with(['customer', 'financialAccount'])->findOrFail($id);

        $amount = (float) $validated['amount'];
        $netPayable = max(0, (float) $order->total_amount - (float) ($order->discount_amount ?? 0) - (float) ($order->exchange_allowance ?? 0));
        $remaining = max(0, $netPayable - (float) $order->paid_amount);

        if ($remaining <= 0) {
            return response()->json([
                'success' => false,
                'message' => 'This sales order is already fully settled and paid.',
            ], 422);
        }

        if ($amount > $remaining + 0.01) {
            return response()->json([
                'success' => false,
                'message' => "Payment amount ({$amount} ETB) exceeds remaining order balance ({$remaining} ETB).",
            ], 422);
        }

        /** @var User|null $user */
        $user = $request->user();
        $tenantId = $order->tenant_id;

        $updatedOrder = DB::transaction(function () use ($order, $amount, $netPayable, $validated, $user, $tenantId) {
            $newPaid = (float) $order->paid_amount + $amount;
            $newRemaining = max(0, $netPayable - $newPaid);
            $newStatus = $newRemaining <= 0 ? 'paid' : 'partially_paid';

            $order->update([
                'paid_amount' => $newPaid,
                'payment_status' => $newStatus,
            ]);

            // Deposit collected payment into destination financial account
            $account = FinancialAccount::findOrFail($validated['financial_account_id']);
            $account->increment('current_balance', $amount);

            $customerName = $order->customer?->name ?? 'Walk-in';

            // Log customer payment in financial transactions
            FinancialTransaction::create([
                'tenant_id' => $tenantId,
                'transaction_number' => 'TXN-'.strtoupper(Str::random(8)),
                'destination_account_id' => $account->id,
                'type' => 'customer_payment',
                'amount' => $amount,
                'reference_number' => $validated['reference_number'] ?? null,
                'contact_id' => $order->customer_id,
                'description' => "Balance collected for Order #{$order->order_number} ({$customerName})",
                'date' => now(),
                'created_by' => $user?->id,
            ]);

            // Synchronize linked receivable Debt record if one exists
            $debt = Debt::where('reference_type', 'sales_order')
                ->where('reference_id', $order->id)
                ->first();

            if ($debt) {
                $debtPaid = (float) $debt->paid_amount + $amount;
                $debtRemaining = max(0, (float) $debt->original_amount - $debtPaid);
                $debtStatus = $debtRemaining <= 0 ? 'settled' : 'partially_paid';

                $debt->update([
                    'paid_amount' => $debtPaid,
                    'remaining_amount' => $debtRemaining,
                    'status' => $debtStatus,
                ]);

                DebtPayment::create([
                    'tenant_id' => $tenantId,
                    'debt_id' => $debt->id,
                    'financial_account_id' => $account->id,
                    'amount' => $amount,
                    'payment_date' => now(),
                    'reference_number' => $validated['reference_number'] ?? null,
                    'notes' => $validated['notes'] ?? "Collected from Sales Order #{$order->order_number}",
                    'created_by' => $user?->id,
                ]);
            }

            AuditLog::record(
                action: 'sales_order_balance_collected',
                entityType: 'SalesOrder',
                entityId: (string) $order->id,
                newValues: [
                    'amount_collected' => $amount,
                    'new_paid_amount' => $newPaid,
                    'payment_status' => $newStatus,
                    'financial_account' => $account->name,
                ]
            );

            return $order->fresh([
                'customer',
                'salesperson',
                'financialAccount',
                'items.variant.product',
                'items.inventoryUnit.variant.product',
                'items.inventoryUnit.swappedFromUnit.variant.product',
                'items.inventoryUnit.swappedReplacementUnit.variant.product',
                'items.inventoryUnit.swappedSalesOrder',
                'items.vendorContact',
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => "Successfully collected {$amount} ETB for Order #{$order->order_number}.",
            'data' => $updatedOrder,
        ]);
    }

    public function storeVendorDirect(Request $request, RecordSaleAction $action): JsonResponse
    {
        $validated = $request->validate([
            // Device specifications
            'product_id' => ['nullable', 'exists:products,id'],
            'variant_id' => ['nullable', 'exists:product_variants,id'],
            'product_name' => ['required_without_all:product_id,variant_id', 'nullable', 'string', 'max:255'],
            'storage' => ['nullable', 'string', 'max:50'],
            'ram' => ['nullable', 'string', 'max:50'],
            'color' => ['nullable', 'string', 'max:50'],
            'imei_or_serial' => ['nullable', 'string', 'max:100'],
            'condition' => ['nullable', 'string', 'max:50'],

            // Vendor details
            'vendor_contact_id' => ['required', 'exists:contacts,id'],
            'vendor_cost' => ['required', 'numeric', 'min:0'],
            'vendor_payment_method' => ['required', 'string', 'in:owed,paid_now'],
            'vendor_payment_account_id' => ['required_if:vendor_payment_method,paid_now', 'nullable', 'exists:financial_accounts,id'],

            // Sale & Customer details
            'selling_price' => ['required', 'numeric', 'min:0'],
            'paid_amount' => ['required', 'numeric', 'min:0'],
            'payment_method' => ['required', 'string', 'in:cash,telebirr,cbe,bank_transfer,credit'],
            'financial_account_id' => ['nullable', 'exists:financial_accounts,id'],
            'customer_id' => ['nullable', 'exists:contacts,id'],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string'],
        ]);

        /** @var User $user */
        $user = $request->user();
        $tenantId = $user->tenant_id;

        // Check overdraft if vendor is paid now from bank
        $vendorCost = (float) $validated['vendor_cost'];
        if ($validated['vendor_payment_method'] === 'paid_now' && $vendorCost > 0) {
            $vendorAcc = FinancialAccount::where('tenant_id', $tenantId)->findOrFail($validated['vendor_payment_account_id']);
            if ((float) $vendorAcc->current_balance < $vendorCost) {
                return response()->json([
                    'success' => false,
                    'message' => "Insufficient balance in {$vendorAcc->name}. Balance is " . number_format($vendorAcc->current_balance, 2) . " ETB, but {$vendorCost} ETB is required. Overdrafts are not permitted.",
                ], 422);
            }
        }

        $order = DB::transaction(function () use ($validated, $user, $tenantId, $vendorCost, $action) {
            // 1. Resolve Product & Variant
            $variantId = $validated['variant_id'] ?? null;
            if (! $variantId) {
                $productId = $validated['product_id'] ?? null;
                if (! $productId) {
                    $product = \App\Models\Product::create([
                        'tenant_id' => $tenantId,
                        'name' => $validated['product_name'],
                        'category' => 'phone_tablet',
                        'has_serials' => true,
                        'is_active' => true,
                    ]);
                    $productId = $product->id;
                }
                $variant = \App\Models\ProductVariant::create([
                    'product_id' => $productId,
                    'storage' => $validated['storage'] ?? null,
                    'ram' => $validated['ram'] ?? null,
                    'color' => $validated['color'] ?? null,
                    'default_selling_price' => $validated['selling_price'],
                ]);
                $variantId = $variant->id;
            }

            // 2. Create the InventoryUnit marked directly as 'sold'
            $imei = ! empty($validated['imei_or_serial']) ? trim($validated['imei_or_serial']) : null;
            if ($imei) {
                $existing = \App\Models\InventoryUnit::where('tenant_id', $tenantId)
                    ->whereIn('status', ['in_stock', 'reserved', 'out'])
                    ->where('imei_or_serial', $imei)
                    ->exists();
                if ($existing) {
                    throw new \InvalidArgumentException("IMEI/Serial '{$imei}' is already in active shop inventory.");
                }
            }

            $unit = \App\Models\InventoryUnit::create([
                'tenant_id' => $tenantId,
                'variant_id' => $variantId,
                'imei_or_serial' => $imei,
                'condition' => $validated['condition'] ?? 'Brand New',
                'cost_basis' => $vendorCost,
                'selling_price' => (float) $validated['selling_price'],
                'status' => 'sold',
                'source_type' => 'vendor_direct',
                'supplier_contact_id' => $validated['vendor_contact_id'],
                'funding_source' => $validated['vendor_payment_method'] === 'paid_now' ? 'bank' : 'payable_owed',
                'payment_account_id' => $validated['vendor_payment_account_id'] ?? null,
                'sold_at' => now(),
                'notes' => 'Vendor Sourced JIT Direct Sale',
            ]);

            // 3. Handle Vendor Payment
            if ($validated['vendor_payment_method'] === 'paid_now' && $vendorCost > 0) {
                $vendorAcc = FinancialAccount::where('tenant_id', $tenantId)->findOrFail($validated['vendor_payment_account_id']);
                if ((float) $vendorAcc->current_balance < $vendorCost) {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'vendor_payment_account_id' => ["Insufficient balance in account '{$vendorAcc->name}'."],
                    ]);
                }
                $vendorAcc->decrement('current_balance', $vendorCost);

                FinancialTransaction::create([
                    'tenant_id' => $tenantId,
                    'transaction_number' => 'TXN-'.strtoupper(\Illuminate\Support\Str::random(8)),
                    'source_account_id' => $vendorAcc->id,
                    'type' => 'supplier_payment',
                    'amount' => $vendorCost,
                    'contact_id' => $validated['vendor_contact_id'],
                    'description' => "Vendor direct payout for IMEI: " . ($imei ?: 'N/A'),
                    'date' => now(),
                    'created_by' => $user->id,
                ]);
            } elseif ($validated['vendor_payment_method'] === 'owed' && $vendorCost > 0) {
                $debt = Debt::create([
                    'tenant_id' => $tenantId,
                    'contact_id' => $validated['vendor_contact_id'],
                    'type' => 'payable',
                    'reference_type' => 'vendor_direct_sale',
                    'reference_id' => $unit->id,
                    'original_amount' => $vendorCost,
                    'paid_amount' => 0.0,
                    'remaining_amount' => $vendorCost,
                    'due_date' => now()->addDays(7),
                    'status' => 'open',
                    'notes' => 'Vendor sourcing payable for SN: '.($imei ?: 'N/A'),
                ]);
                Debt::applyOpenAdvancesToPayable($debt);
            }

            // 4. Create the SalesOrder via RecordSaleAction
            $saleData = [
                'customer_id' => $validated['customer_id'] ?? null,
                'customer_name' => $validated['customer_name'] ?? null,
                'customer_phone' => $validated['customer_phone'] ?? null,
                'salesperson_id' => $user->id,
                'paid_amount' => (float) $validated['paid_amount'],
                'payment_method' => $validated['payment_method'],
                'financial_account_id' => $validated['financial_account_id'] ?? null,
                'notes' => $validated['notes'] ?? 'Vendor Direct Sale',
                'items' => [
                    [
                        'variant_id' => $variantId,
                        'inventory_unit_id' => $unit->id,
                        'quantity' => 1,
                        'unit_price' => (float) $validated['selling_price'],
                        'sourcing_type' => 'brokered_neighbour',
                        'vendor_contact_id' => $validated['vendor_contact_id'],
                        'vendor_cost' => $vendorCost,
                    ],
                ],
            ];

            $order = $action->execute($saleData);
            $order->update([
                'is_vendor_sourced' => true,
                'vendor_contact_id' => $validated['vendor_contact_id'],
                'vendor_cost_basis' => $vendorCost,
                'vendor_payment_status' => $validated['vendor_payment_method'] === 'paid_now' ? 'paid' : 'owed',
            ]);

            return $order->fresh([
                'customer',
                'vendor',
                'salesperson',
                'financialAccount',
                'items.variant.product',
                'items.inventoryUnit',
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Vendor direct sale completed successfully.',
            'data' => $order,
        ], 201);
    }
}
