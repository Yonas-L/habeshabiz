<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Contact;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\InventoryStock;
use App\Models\InventoryUnit;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryController extends Controller
{
    public function units(Request $request): JsonResponse
    {
        $query = InventoryUnit::with([
            'variant.product.categoryRel',
            'supplier',
            'maintenanceRecords.financialAccount',
            'salesOrderItem.salesOrder.customer',
            'salesOrderItem.salesOrder.salesperson',
            'salesOrderItem.salesOrder.financialAccount',
            'salesOrderItem.salesOrder.exchangeUnit.variant.product',
            'swappedSalesOrder',
            'swappedFromUnit.variant.product',
            'swappedReplacementUnit.variant.product',
        ]);

        if ($request->filled('source_type') && $request->source_type !== 'all') {
            $query->where('source_type', $request->source_type);
        }

        if ($request->status === 'vendor_stock') {
            $query->where('status', 'in_stock')->where('source_type', 'consignment');
        } elseif ($request->status === 'exchange_stock') {
            $query->where('status', 'in_stock')->where('source_type', 'exchange');
        } elseif ($request->status === 'returned_to_vendor') {
            $query->where('status', 'returned_to_vendor');
        } elseif ($request->status === 'returned') {
            $query->whereIn('status', ['returned', 'fixed', 'returned_to_vendor']);
        } elseif ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        } elseif (! $request->filled('status')) {
            $query->where('status', 'in_stock');
        }

        if ($request->filled('variant_id')) {
            $query->where('variant_id', $request->variant_id);
        }

        if ($request->filled('product_id')) {
            $query->whereHas('variant', fn ($vq) => $vq->where('product_id', $request->product_id));
        }

        if ($request->filled('category_id')) {
            $categoryId = $request->category_id;
            $query->whereHas('variant.product', function ($pq) use ($categoryId) {
                $pq->where('category_id', $categoryId);
            });
        } elseif ($request->filled('category')) {
            $cat = $request->category;
            $query->whereHas('variant.product', function ($pq) use ($cat) {
                $pq->where('category', $cat);
            });
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('imei_or_serial', 'ilike', "%{$search}%")
                    ->orWhere('condition', 'ilike', "%{$search}%")
                    ->orWhere('handover_to', 'ilike', "%{$search}%")
                    ->orWhere('return_reason', 'ilike', "%{$search}%")
                    ->orWhereHas('variant.product', function ($pq) use ($search) {
                        $pq->where('name', 'ilike', "%{$search}%");
                    })
                    ->orWhereHas('supplier', function ($sq) use ($search) {
                        $sq->where('name', 'ilike', "%{$search}%");
                    });
            });
        }

        $units = $query->latest()->get();

        // Calculate tab counts
        $serializedInStock = InventoryUnit::where('status', 'in_stock')->count();
        $nonSerializedInStock = (int) InventoryStock::whereHas('variant.product', fn ($q) => $q->where('has_serials', false))
            ->whereDoesntHave('variant.inventoryUnits', fn ($q) => $q->where('status', 'in_stock'))
            ->sum('quantity_on_hand');

        $counts = [
            'in_stock' => $serializedInStock + $nonSerializedInStock,
            'vendor_stock' => InventoryUnit::where('status', 'in_stock')->where('source_type', 'consignment')->count(),
            'exchange_stock' => InventoryUnit::where('status', 'in_stock')->where('source_type', 'exchange')->count(),
            'out' => InventoryUnit::where('status', 'out')->count(),
            'sold' => InventoryUnit::where('status', 'sold')->count(),
            'returned' => InventoryUnit::whereIn('status', ['returned', 'fixed', 'returned_to_vendor'])->count(),
            'returned_to_vendor' => InventoryUnit::where('status', 'returned_to_vendor')->count(),
            'all' => InventoryUnit::count() + $nonSerializedInStock,
        ];

        // Check if user is allowed to view cost basis
        /** @var User|null $user */
        $user = $request->user();
        $canViewCost = $user ? $user->canViewCosts() : false;

        $mapped = $units->map(function ($unit) use ($canViewCost) {
            $data = $unit->toArray();
            if (! $canViewCost) {
                unset($data['cost_basis']);
            }

            return $data;
        });

        return response()->json([
            'success' => true,
            'data' => $mapped,
            'counts' => $counts,
        ]);
    }

    public function intakeUnit(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Stock intake is restricted to store owners/administrators.',
            ], 403);
        }

        $validated = $request->validate([
            'variant_id' => ['required', 'exists:product_variants,id'],
            'imei_or_serial' => ['nullable', 'string', 'max:100'],
            'imeis' => ['nullable', 'array'],
            'imeis.*' => ['string', 'max:100'],
            'quantity' => ['nullable', 'integer', 'min:1'],
            'battery_health' => ['nullable', 'integer', 'min:0', 'max:100'],
            'cycle_count' => ['nullable', 'integer', 'min:0'],
            'sim_type' => ['nullable', 'string', 'in:physical,esim,dual,na'],
            'condition' => ['required', 'string', 'max:50'],
            'cost_basis' => ['required', 'numeric', 'min:0'],
            'selling_price' => ['nullable', 'numeric', 'min:0'],
            'source_type' => ['nullable', 'string', 'in:purchase,consignment'],
            'supplier_contact_id' => ['nullable', 'exists:contacts,id'],
            'return_deadline' => ['nullable', 'date'],
            'location' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string'],
        ]);

        if (($validated['source_type'] ?? 'purchase') === 'consignment' && empty($validated['supplier_contact_id'])) {
            return response()->json([
                'success' => false,
                'message' => 'A vendor or broker must be selected for consignment stock.',
            ], 422);
        }

        if (empty($validated['sim_type'])) {
            $validated['sim_type'] = 'na';
        }

        $variant = \App\Models\ProductVariant::with('product')->findOrFail($validated['variant_id']);

        // Update default selling price if provided
        if (! empty($validated['selling_price'])) {
            $variant->update(['default_selling_price' => $validated['selling_price']]);
        }

        $hasSerials = (bool) ($variant->product?->has_serials ?? true);

        // Parse list of submitted IMEIs
        $imeisList = [];
        if (! empty($validated['imeis']) && is_array($validated['imeis'])) {
            $imeisList = array_values(array_filter(array_map('trim', $validated['imeis'])));
        } elseif (! empty($validated['imei_or_serial'])) {
            $parsed = preg_split('/[\r\n,]+/', trim($validated['imei_or_serial']));
            $imeisList = array_values(array_filter(array_map('trim', $parsed)));
        }

        // For serialized products, IMEI is required
        if ($hasSerials && empty($imeisList)) {
            return response()->json([
                'success' => false,
                'message' => 'Serial number or IMEI is required for serialized products.',
            ], 422);
        }

        // Check for duplicates within the submitted IMEIs
        if (! empty($imeisList)) {
            $duplicates = array_diff_assoc($imeisList, array_unique($imeisList));
            if (! empty($duplicates)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Duplicate IMEI/Serial number in submission: ' . implode(', ', array_unique($duplicates)),
                ], 422);
            }

            // Check if any submitted IMEI already exists in active inventory for this tenant
            $tenantId = $user->tenant_id;
            $existing = InventoryUnit::where('tenant_id', $tenantId)
                ->whereIn('status', ['in_stock', 'reserved', 'out'])
                ->whereIn('imei_or_serial', $imeisList)
                ->pluck('imei_or_serial')
                ->all();

            if (! empty($existing)) {
                return response()->json([
                    'success' => false,
                    'message' => 'The following IMEI/Serial number(s) are already in active shop inventory: ' . implode(', ', $existing),
                ], 422);
            }
        }

        $createdUnits = [];
        $costBasis = (float) $validated['cost_basis'];

        \Illuminate\Support\Facades\DB::transaction(function () use ($validated, $variant, $hasSerials, $imeisList, $costBasis, $user, &$createdUnits) {
            $countToCreate = $hasSerials
                ? count($imeisList)
                : max(1, (int) ($validated['quantity'] ?? 1));

            for ($i = 0; $i < $countToCreate; $i++) {
                $imei = $hasSerials ? ($imeisList[$i] ?? null) : null;
                if ($hasSerials && empty($imei)) {
                    continue;
                }

                $unit = InventoryUnit::create([
                    'tenant_id' => $user->tenant_id,
                    'variant_id' => $variant->id,
                    'imei_or_serial' => $imei,
                    'battery_health' => $validated['battery_health'] ?? null,
                    'cycle_count' => $validated['cycle_count'] ?? null,
                    'sim_type' => $validated['sim_type'],
                    'condition' => $validated['condition'],
                    'cost_basis' => $costBasis,
                    'status' => 'in_stock',
                    'source_type' => $validated['source_type'] ?? 'purchase',
                    'supplier_contact_id' => $validated['supplier_contact_id'] ?? null,
                    'return_deadline' => $validated['return_deadline'] ?? null,
                    'location' => $validated['location'] ?? 'Shop Counter',
                    'notes' => $validated['notes'] ?? null,
                ]);

                $createdUnits[] = $unit;

                // Start payable debt the minute a vendor item is stocked into inventory
                if (! empty($validated['supplier_contact_id']) && $costBasis > 0) {
                    $intakeDebt = Debt::create([
                        'tenant_id' => $user->tenant_id,
                        'contact_id' => $validated['supplier_contact_id'],
                        'type' => 'payable',
                        'reference_type' => 'stock_intake',
                        'reference_id' => $unit->id,
                        'original_amount' => $costBasis,
                        'paid_amount' => 0.0,
                        'remaining_amount' => $costBasis,
                        'due_date' => $validated['return_deadline'] ?? now()->addDays(30),
                        'status' => 'open',
                        'notes' => ($variant->product?->name ?? 'Device') . ($imei ? " (SN: {$imei})" : ''),
                    ]);

                    Debt::applyOpenAdvancesToPayable($intakeDebt);
                }
            }

            // Sync InventoryStock record
            $stock = InventoryStock::firstOrCreate(
                ['tenant_id' => $user->tenant_id, 'variant_id' => $variant->id],
                ['quantity_on_hand' => 0, 'average_cost' => $costBasis]
            );

            $currentQty = $stock->quantity_on_hand;
            $currentAvg = (float) $stock->average_cost;
            $newTotalQty = $currentQty + $countToCreate;
            $newAvgCost = $newTotalQty > 0
                ? (($currentQty * $currentAvg) + ($countToCreate * $costBasis)) / $newTotalQty
                : $costBasis;

            $stock->update([
                'quantity_on_hand' => $newTotalQty,
                'average_cost' => round($newAvgCost, 2),
            ]);

            AuditLog::record(
                action: 'stock_intake',
                entityType: 'InventoryUnit',
                entityId: (string) ($createdUnits[0]->id ?? $variant->id),
                newValues: [
                    'product' => $variant->product?->name,
                    'variant' => $variant->display_name,
                    'units_count' => $countToCreate,
                    'cost_basis' => $costBasis,
                    'condition' => $validated['condition'],
                    'location' => $validated['location'] ?? 'Shop Counter',
                ]
            );
        });

        $count = count($createdUnits);
        $unitLabel = $count === 1 ? '1 unit' : "{$count} units";

        return response()->json([
            'success' => true,
            'message' => "Successfully recorded {$unitLabel} of {$variant->display_name} into stock.",
            'data' => $createdUnits[0]->load('variant.product'),
            'units_created' => $count,
        ], 201);
    }

    /**
     * Update details of an existing inventory unit (IMEI, condition, cost basis, selling price, diagnostics, location, notes, supplier).
     */
    public function updateUnit(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Editing inventory unit details is restricted to store owners/administrators.',
            ], 403);
        }

        $unit = InventoryUnit::with(['variant.product', 'supplier'])->findOrFail($id);

        $validated = $request->validate([
            'imei_or_serial' => ['nullable', 'string', 'max:100'],
            'condition' => ['nullable', 'string', 'max:50'],
            'cost_basis' => ['nullable', 'numeric', 'min:0'],
            'selling_price' => ['nullable', 'numeric', 'min:0'],
            'battery_health' => ['nullable', 'integer', 'min:0', 'max:100'],
            'cycle_count' => ['nullable', 'integer', 'min:0'],
            'sim_type' => ['nullable', 'string', 'in:physical,esim,dual,na'],
            'location' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string'],
            'supplier_contact_id' => ['nullable', 'exists:contacts,id'],
        ]);

        // If IMEI is provided and changed, ensure no other active unit has it
        if (array_key_exists('imei_or_serial', $validated)) {
            $newImei = trim($validated['imei_or_serial'] ?? '');
            if ($newImei !== '' && $newImei !== $unit->imei_or_serial) {
                $duplicate = InventoryUnit::where('tenant_id', $user->tenant_id)
                    ->where('id', '!=', $unit->id)
                    ->whereIn('status', ['in_stock', 'reserved', 'out'])
                    ->where('imei_or_serial', $newImei)
                    ->exists();

                if ($duplicate) {
                    return response()->json([
                        'success' => false,
                        'message' => "The IMEI/Serial number '{$newImei}' is already in active shop inventory.",
                    ], 422);
                }
            }
            $validated['imei_or_serial'] = $newImei !== '' ? $newImei : null;
        }

        $oldValues = $unit->only([
            'imei_or_serial',
            'condition',
            'cost_basis',
            'selling_price',
            'battery_health',
            'cycle_count',
            'sim_type',
            'location',
            'notes',
            'supplier_contact_id',
        ]);

        $costBasisChanged = array_key_exists('cost_basis', $validated)
            && $validated['cost_basis'] !== null
            && (float) $validated['cost_basis'] !== (float) $unit->cost_basis;

        \Illuminate\Support\Facades\DB::transaction(function () use ($unit, $validated, $oldValues, $costBasisChanged) {
            $unit->update($validated);

            if ($costBasisChanged && $unit->status === 'in_stock') {
                (new \App\Actions\SynchronizeInventoryStockAction())->execute();
            }

            AuditLog::record(
                action: 'updated_unit',
                entityType: 'InventoryUnit',
                entityId: (string) $unit->id,
                oldValues: $oldValues,
                newValues: $validated
            );
        });

        $freshUnit = $unit->fresh()->load([
            'variant.product.categoryRel',
            'supplier',
            'maintenanceRecords.financialAccount',
            'salesOrderItem.salesOrder.customer',
            'salesOrderItem.salesOrder.salesperson',
            'salesOrderItem.salesOrder.financialAccount',
            'salesOrderItem.salesOrder.exchangeUnit.variant.product',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Device details updated successfully.',
            'data' => $freshUnit,
        ]);
    }

    /**
     * Mark an in-stock unit as taken out by a staff member or broker to sell.
     */
    public function handoverUnit(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Device handover and flow actions are restricted to store owners/administrators.',
            ], 403);
        }

        $unit = InventoryUnit::findOrFail($id);

        if ($unit->status !== 'in_stock') {
            return response()->json([
                'success' => false,
                'message' => 'Only in-stock items can be marked as out for sale.',
            ], 422);
        }

        $validated = $request->validate([
            'handover_to' => ['required', 'string', 'max:100'],
            'location' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string'],
            'return_deadline' => ['nullable', 'date', 'after_or_equal:today'],
            'handover_payout' => ['nullable', 'numeric', 'min:0'],
        ]);

        $unit->update([
            'status' => 'out',
            'handover_to' => $validated['handover_to'],
            'handed_out_at' => now(),
            'location' => $validated['location'] ?? "Out with {$validated['handover_to']}",
            'return_deadline' => $validated['return_deadline'] ?? null,
            'handover_payout' => $validated['handover_payout'] ?? null,
            'notes' => ! empty($validated['notes'])
                ? ($unit->notes ? "{$unit->notes} | {$validated['notes']}" : $validated['notes'])
                : $unit->notes,
        ]);

        // Create a receivable debt (vendor owes you this amount) when a payout is agreed
        $debtCreated = false;
        if (! empty($validated['handover_payout']) && (float) $validated['handover_payout'] > 0) {
            $payoutAmount = (float) $validated['handover_payout'];

            // Try to find a matching contact for the handover person
            $contact = Contact::where('name', 'ilike', $validated['handover_to'])->first();

            if (! $contact) {
                $contact = Contact::create([
                    'tenant_id' => $unit->tenant_id,
                    'name' => $validated['handover_to'],
                    'roles' => ['vendor', 'partner'],
                    'is_active' => true,
                ]);
            }

            if ($contact) {
                Debt::create([
                    'tenant_id' => $unit->tenant_id,
                    'contact_id' => $contact->id,
                    'type' => 'receivable',
                    'reference_type' => 'handover_holding',
                    'reference_id' => $unit->id,
                    'original_amount' => $payoutAmount,
                    'paid_amount' => 0.0,
                    'remaining_amount' => $payoutAmount,
                    'due_date' => $validated['return_deadline'] ?? now()->addDays(7),
                    'status' => 'open',
                    'notes' => "Handover payout for {$unit->imei_or_serial} to {$validated['handover_to']}. Vendor must pay this amount on sale or return the device.",
                ]);
                $debtCreated = true;
            }
        }

        AuditLog::record(
            action: 'unit_handover',
            entityType: 'InventoryUnit',
            entityId: (string) $unit->id,
            newValues: [
                'imei_or_serial' => $unit->imei_or_serial,
                'handover_to' => $validated['handover_to'],
                'location' => $unit->location,
                'return_deadline' => $validated['return_deadline'] ?? null,
                'handover_payout' => $validated['handover_payout'] ?? null,
                'debt_created' => $debtCreated,
            ]
        );

        $message = "Item handed out to {$validated['handover_to']} for sale.";
        if ($debtCreated) {
            $message .= " Receivable of " . number_format((float) $validated['handover_payout'], 2) . " ETB recorded.";
        }

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $unit->load('variant.product'),
        ]);
    }

    /**
     * Restock an unsold item that was out with staff/broker back to shop shelf.
     * Note: Sold items are NOT restocked directly; they must go through customer return.
     */
    public function restockUnit(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Restocking units is restricted to store owners/administrators.',
            ], 403);
        }

        $unit = InventoryUnit::findOrFail($id);

        if ($unit->status === 'sold') {
            return response()->json([
                'success' => false,
                'message' => 'Sold products cannot be restocked. If returned by a customer, please process as a Customer Return.',
            ], 422);
        }

        if ($unit->status === 'in_stock') {
            return response()->json([
                'success' => false,
                'message' => 'This product is already in stock on the shop shelf.',
            ], 422);
        }

        $previousHandover = $unit->handover_to;

        \Illuminate\Support\Facades\DB::transaction(function () use ($unit, $previousHandover) {
            $unit->update([
                'status' => 'in_stock',
                'handover_to' => null,
                'handed_out_at' => null,
                'handover_payout' => null,
                'return_deadline' => null,
                'location' => 'Shop Counter',
                'sold_at' => null,
            ]);

            // Cancel any open or partially_paid handover_holding receivable debt for this unit
            $holdingDebts = Debt::where('reference_type', 'handover_holding')
                ->where('reference_id', $unit->id)
                ->whereIn('status', ['open', 'partially_paid'])
                ->get();

            foreach ($holdingDebts as $debt) {
                if ($debt->remaining_amount > 0) {
                    DebtPayment::create([
                        'tenant_id' => $unit->tenant_id,
                        'debt_id' => $debt->id,
                        'amount' => (float) $debt->remaining_amount,
                        'payment_date' => now(),
                        'reference_number' => 'RETURN-TO-SHOP',
                        'notes' => 'Device returned unsold to shop, cancelling handover holding receivable',
                    ]);

                    $debt->update([
                        'paid_amount' => $debt->original_amount,
                        'remaining_amount' => 0.0,
                        'status' => 'settled',
                        'notes' => ($debt->notes ? $debt->notes . ' | ' : '') . 'CANCELLED — device returned unsold by ' . ($previousHandover ?? 'vendor') . '.',
                    ]);
                }
            }

            (new \App\Actions\SynchronizeInventoryStockAction())->execute();
        });

        $note = $previousHandover ? " (returned unsold by {$previousHandover})" : '';

        AuditLog::record(
            action: 'unit_restocked',
            entityType: 'InventoryUnit',
            entityId: (string) $unit->id,
            newValues: [
                'imei_or_serial' => $unit->imei_or_serial,
                'previous_handover' => $previousHandover,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => "Device restocked back to shelf inventory{$note}.",
            'data' => $unit->load('variant.product'),
        ]);
    }

    /**
     * Mark a handed-out device as sold by the vendor/broker.
     * Settles the linked handover_holding receivable (via cash/bank, bilateral offset, or retains as credit)
     * and permanently transitions the unit to sold status (blocking any direct restocking).
     */
    public function markHandoverSold(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only store owners can confirm handover device sales.',
            ], 403);
        }

        $unit = InventoryUnit::with(['variant.product', 'supplier'])->findOrFail($id);

        if ($unit->status !== 'out') {
            return response()->json([
                'success' => false,
                'message' => "Only items currently handed out for sale (status: 'out') can be marked as sold via this flow.",
            ], 422);
        }

        $validated = $request->validate([
            'settlement_type' => ['required', 'string', 'in:paid,offset,credit'],
            'selling_price' => ['nullable', 'numeric', 'min:0'],
            'financial_account_id' => ['required_if:settlement_type,paid', 'nullable', 'uuid', 'exists:financial_accounts,id'],
            'payment_date' => ['nullable', 'date'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $settlementType = $validated['settlement_type'];
        $finalPrice = ! empty($validated['selling_price'])
            ? (float) $validated['selling_price']
            : (float) ($unit->handover_payout ?? $unit->selling_price ?? 0);

        \Illuminate\Support\Facades\DB::transaction(function () use ($unit, $validated, $settlementType, $finalPrice, $user) {
            $now = now();
            $vendorName = $unit->handover_to ?? 'Vendor/Broker';

            // Find any open or partially_paid handover_holding debts for this unit
            $holdingDebt = Debt::where('reference_type', 'handover_holding')
                ->where('reference_id', $unit->id)
                ->whereIn('status', ['open', 'partially_paid'])
                ->first();

            if ($settlementType === 'paid') {
                $account = \App\Models\FinancialAccount::findOrFail($validated['financial_account_id']);
                $paymentAmount = $holdingDebt ? (float) $holdingDebt->remaining_amount : $finalPrice;

                if ($holdingDebt && $paymentAmount > 0) {
                    (new \App\Actions\SettleDebtPaymentAction())->execute($holdingDebt, [
                        'amount' => $paymentAmount,
                        'financial_account_id' => $account->id,
                        'payment_date' => $validated['payment_date'] ?? $now,
                        'reference_number' => $validated['reference_number'] ?? null,
                        'notes' => $validated['notes'] ?? "Handover device sale collected from {$vendorName}",
                    ]);
                } elseif ($paymentAmount > 0) {
                    $account->increment('current_balance', $paymentAmount);
                    \App\Models\FinancialTransaction::create([
                        'tenant_id' => $user->tenant_id,
                        'financial_account_id' => $account->id,
                        'type' => 'income',
                        'category' => 'Sales Revenue',
                        'amount' => $paymentAmount,
                        'balance_after' => (float) $account->current_balance,
                        'transaction_date' => $validated['payment_date'] ?? $now,
                        'description' => "Handover device sale payout from {$vendorName} for SN {$unit->imei_or_serial}",
                        'reference_type' => 'inventory_unit',
                        'reference_id' => $unit->id,
                        'created_by' => $user->id,
                    ]);
                }
            } elseif ($settlementType === 'offset') {
                // Bilateral offset: mutual debt or device swap cover
                if ($holdingDebt && $holdingDebt->remaining_amount > 0) {
                    $offsetAmount = (float) $holdingDebt->remaining_amount;
                    DebtPayment::create([
                        'tenant_id' => $user->tenant_id,
                        'debt_id' => $holdingDebt->id,
                        'amount' => $offsetAmount,
                        'payment_date' => $validated['payment_date'] ?? $now,
                        'reference_number' => 'BILATERAL-OFFSET',
                        'notes' => $validated['notes'] ?? "Settled via bilateral offset / device trade with {$vendorName}",
                        'created_by' => $user->id,
                    ]);

                    $holdingDebt->update([
                        'paid_amount' => $holdingDebt->original_amount,
                        'remaining_amount' => 0.0,
                        'status' => 'settled',
                        'notes' => ($holdingDebt->notes ? $holdingDebt->notes . ' | ' : '') . "Settled via bilateral offset with {$vendorName}.",
                    ]);
                }
            } elseif ($settlementType === 'credit') {
                // Credit: Device sold to end-user, payment collection pending
                if ($holdingDebt) {
                    $holdingDebt->update([
                        'notes' => ($holdingDebt->notes ? $holdingDebt->notes . ' | ' : '') . "Device confirmed SOLD by {$vendorName}. Awaiting payment collection.",
                    ]);
                } else {
                    $contact = \App\Models\Contact::where('name', 'ilike', $vendorName)->first();
                    if ($contact && $finalPrice > 0) {
                        Debt::create([
                            'tenant_id' => $user->tenant_id,
                            'contact_id' => $contact->id,
                            'type' => 'receivable',
                            'reference_type' => 'handover_holding',
                            'reference_id' => $unit->id,
                            'original_amount' => $finalPrice,
                            'paid_amount' => 0.0,
                            'remaining_amount' => $finalPrice,
                            'due_date' => now()->addDays(7),
                            'status' => 'open',
                            'notes' => "Confirmed sold on credit by {$vendorName} for {$unit->imei_or_serial}. Awaiting payment.",
                        ]);
                    }
                }
            }

            // Permanently update unit status to 'sold'
            $notesAppend = "Sold by {$vendorName} on " . $now->format('M d, Y') . " ({$settlementType} settlement).";
            if (! empty($validated['notes'])) {
                $notesAppend .= " Note: {$validated['notes']}";
            }

            $unit->fresh()->update([
                'status' => 'sold',
                'sold_at' => $now,
                'selling_price' => $finalPrice > 0 ? $finalPrice : $unit->selling_price,
                'location' => "Sold by {$vendorName}",
                'notes' => $unit->notes ? "{$unit->notes} | {$notesAppend}" : $notesAppend,
            ]);

            // Decrement active stock quantity if applicable
            $stock = InventoryStock::where('variant_id', $unit->variant_id)->first();
            if ($stock && $stock->quantity_on_hand > 0) {
                $stock->decrement('quantity_on_hand', 1);
            }

            (new \App\Actions\SynchronizeInventoryStockAction())->execute();

            AuditLog::record(
                action: 'handover_marked_sold',
                entityType: 'InventoryUnit',
                entityId: (string) $unit->id,
                newValues: [
                    'imei_or_serial' => $unit->imei_or_serial,
                    'handover_to' => $vendorName,
                    'settlement_type' => $settlementType,
                    'selling_price' => $finalPrice,
                ]
            );
        });

        return response()->json([
            'success' => true,
            'message' => "Device successfully marked as sold by {$unit->handover_to}. It cannot be restocked directly.",
            'data' => $unit->fresh()->load('variant.product'),
        ]);
    }

    /**
     * Process a return of a sold item by a customer.
     * Requires a reason and places unit in returned/repair tracking.
     */
    public function customerReturn(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Processing customer returns is restricted to store owners/administrators.',
            ], 403);
        }

        $unit = InventoryUnit::findOrFail($id);

        if ($unit->status !== 'sold') {
            return response()->json([
                'success' => false,
                'message' => 'Only sold products can be processed as customer returns.',
            ], 422);
        }

        $validated = $request->validate([
            'return_reason' => ['required', 'string', 'max:500'],
            'condition' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string'],
            'destination' => ['nullable', 'string', 'in:repair,vendor'],
            'customer_waiting' => ['nullable', 'boolean'],
        ]);

        $destination = $validated['destination'] ?? 'repair';
        $status = $destination === 'vendor' ? 'returned_to_vendor' : 'returned';
        $location = $destination === 'vendor' ? 'Returned to Vendor/Supplier' : 'Repair & Inspection Shelf';
        $isCustomerWaiting = array_key_exists('customer_waiting', $validated)
            ? (bool) $validated['customer_waiting']
            : true;

        $unit->update([
            'status' => $status,
            'customer_waiting' => $isCustomerWaiting,
            'customer_waiting_at' => $isCustomerWaiting ? now() : null,
            'return_reason' => $validated['return_reason'],
            'returned_at' => now(),
            'condition' => $validated['condition'] ?? $unit->condition,
            'location' => $location,
            'notes' => ! empty($validated['notes'])
                ? ($unit->notes ? "{$unit->notes} | Return note: {$validated['notes']}" : "Return note: {$validated['notes']}")
                : $unit->notes,
        ]);

        AuditLog::record(
            action: 'customer_return',
            entityType: 'InventoryUnit',
            entityId: (string) $unit->id,
            newValues: [
                'imei_or_serial' => $unit->imei_or_serial,
                'return_reason' => $validated['return_reason'],
                'destination' => $destination,
                'customer_waiting' => $isCustomerWaiting,
            ]
        );

        $msg = $destination === 'vendor'
            ? 'Device returned by customer and marked as returned to vendor/supplier.'
            : 'Device returned by customer. Moved to Repair & Inspection shelf.';

        return response()->json([
            'success' => true,
            'message' => $msg,
            'data' => $unit->load(['variant.product', 'supplier']),
        ]);
    }

    /**
     * Mark a returned/repaired unit as repaired and restock it to shop shelf.
     */
    public function repairAndRestock(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Repair and restock is restricted to store owners/administrators.',
            ], 403);
        }

        $unit = InventoryUnit::with(['variant.product', 'maintenanceRecords'])->findOrFail($id);

        if (! in_array($unit->status, ['returned', 'fixed', 'damaged'])) {
            return response()->json([
                'success' => false,
                'message' => 'Only returned, fixed, or damaged items can be processed as repaired & restocked.',
            ], 422);
        }

        $validated = $request->validate([
            'action' => ['nullable', 'string', 'in:restock,deliver_to_customer'],
            'condition' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string'],
            'new_selling_price' => ['nullable', 'numeric', 'min:0'],
            'cost_basis' => ['nullable', 'numeric', 'min:0'],
            'imei_or_serial' => ['nullable', 'string', 'max:100'],
        ]);

        $action = $validated['action'] ?? ($unit->customer_waiting ? 'deliver_to_customer' : 'restock');

        $targetImei = array_key_exists('imei_or_serial', $validated)
            ? (trim($validated['imei_or_serial'] ?? '') ?: null)
            : $unit->imei_or_serial;

        if ($action === 'restock' && ! empty($targetImei)) {
            $duplicate = InventoryUnit::where('tenant_id', $user->tenant_id)
                ->where('id', '!=', $unit->id)
                ->whereIn('status', ['in_stock', 'reserved', 'out'])
                ->where('imei_or_serial', $targetImei)
                ->with('variant.product')
                ->first();

            if ($duplicate) {
                $dupName = $duplicate->variant?->product?->name ?? 'another device';
                $dupSpec = array_filter([$duplicate->variant?->color, $duplicate->variant?->storage]);
                $dupDesc = $dupSpec ? "{$dupName} (" . implode(' ', $dupSpec) . ")" : $dupName;

                return response()->json([
                    'success' => false,
                    'message' => "Cannot restock device: IMEI/Serial '{$targetImei}' is already assigned to an active {$dupDesc} currently in shop stock. Please change or edit the IMEI before restocking.",
                ], 422);
            }
        }

        // Find uncapitalized maintenance records for this unit
        $uncapitalized = $unit->maintenanceRecords()->where('is_capitalized', false)->get();
        $maintenanceCost = (float) $uncapitalized->sum('cost');

        $currentCost = (float) ($unit->cost_basis ?? 0);
        $newCostBasis = isset($validated['cost_basis'])
            ? (float) $validated['cost_basis']
            : ($currentCost + $maintenanceCost);

        if ($action === 'deliver_to_customer') {
            $unitUpdate = [
                'status' => 'sold',
                'is_repaired' => true,
                'location' => 'With Customer',
                'customer_waiting' => false,
                'customer_waiting_at' => null,
                'condition' => $validated['condition'] ?? $unit->condition,
                'notes' => ! empty($validated['notes'])
                    ? ($unit->notes ? "{$unit->notes} | Repair note: {$validated['notes']}" : "Repair note: {$validated['notes']}")
                    : $unit->notes,
            ];

            if (array_key_exists('imei_or_serial', $validated)) {
                $unitUpdate['imei_or_serial'] = $targetImei;
            }

            $salesOrderItem = $unit->salesOrderItem;
            if ($salesOrderItem && $salesOrderItem->salesOrder) {
                $salesOrder = $salesOrderItem->salesOrder;
                $orderAuditNote = "[Shop Repair " . now()->format('M d, Y H:i') . ": Repaired and delivered to customer.]";
                $salesOrder->update([
                    'notes' => $salesOrder->notes ? "{$salesOrder->notes}\n{$orderAuditNote}" : $orderAuditNote,
                ]);
            }
        } else {
            $unitUpdate = [
                'status' => 'in_stock',
                'is_repaired' => true,
                'cost_basis' => $newCostBasis,
                'condition' => $validated['condition'] ?? $unit->condition,
                'location' => 'Shop Counter',
                'customer_waiting' => false,
                'customer_waiting_at' => null,
                'notes' => ! empty($validated['notes'])
                    ? ($unit->notes ? "{$unit->notes} | Repair note: {$validated['notes']}" : "Repair note: {$validated['notes']}")
                    : $unit->notes,
            ];

            if (array_key_exists('imei_or_serial', $validated)) {
                $unitUpdate['imei_or_serial'] = $targetImei;
            }

            // If updated retail selling price provided, set it specifically for THIS unit
            if (! empty($validated['new_selling_price']) && (float) $validated['new_selling_price'] > 0) {
                $unitUpdate['selling_price'] = $validated['new_selling_price'];
            }
        }

        $unit->update($unitUpdate);

        // Mark maintenance records as capitalized
        $uncapitalized->each(fn ($record) => $record->update(['is_capitalized' => true]));

        // Synchronize InventoryStock quantity_on_hand and average_cost if restocked
        if ($action === 'restock' && $unit->variant_id) {
            $stock = InventoryStock::firstOrCreate(
                ['tenant_id' => $unit->tenant_id, 'variant_id' => $unit->variant_id],
                ['quantity_on_hand' => 0, 'average_cost' => $newCostBasis]
            );
            $inStockUnits = InventoryUnit::where('variant_id', $unit->variant_id)
                ->where('status', 'in_stock')
                ->get();
            $stock->quantity_on_hand = $inStockUnits->count();
            if ($inStockUnits->count() > 0) {
                $stock->average_cost = $inStockUnits->avg('cost_basis');
            }
            $stock->save();
        }

        AuditLog::record(
            action: $action === 'deliver_to_customer' ? 'unit_repaired_delivered' : 'unit_repaired_restocked',
            entityType: 'InventoryUnit',
            entityId: (string) $unit->id,
            newValues: [
                'imei_or_serial' => $unit->imei_or_serial,
                'condition' => $unit->condition,
                'action' => $action,
                'maintenance_capitalized' => $maintenanceCost,
                'new_cost_basis' => $unit->cost_basis,
                'unit_selling_price' => $unit->selling_price,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => $action === 'deliver_to_customer'
                ? 'Device repaired and delivered back to customer custody.'
                : 'Device repaired and restocked back to shop shelf with updated cost basis.',
            'data' => $unit->load(['variant.product', 'maintenanceRecords.financialAccount']),
        ]);
    }

    /**
     * Return an unsold vendor consignment item back to the broker/seller.
     * Decrements stock and marks unit as returned_to_vendor.
     */
    public function returnToVendor(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Returning units to vendor is restricted to store owners/administrators.',
            ], 403);
        }

        $unit = InventoryUnit::with(['variant.product', 'supplier'])->findOrFail($id);

        if ($unit->status === 'sold') {
            return response()->json([
                'success' => false,
                'message' => 'Sold products cannot be returned to vendor. If returned by customer, handle customer return first.',
            ], 422);
        }

        if ($unit->status === 'returned_to_vendor') {
            return response()->json([
                'success' => false,
                'message' => 'This device has already been returned to the vendor.',
            ], 422);
        }

        $validated = $request->validate([
            'return_reason' => ['nullable', 'string', 'max:500'],
            'notes' => ['nullable', 'string'],
        ]);

        $vendorName = $unit->supplier?->name ?? 'Vendor';
        $previousStatus = $unit->status;

        \Illuminate\Support\Facades\DB::transaction(function () use ($unit, $validated, $previousStatus) {
            $unit->update([
                'status' => 'returned_to_vendor',
                'returned_at' => now(),
                'return_reason' => $validated['return_reason'] ?? 'Returned unsold to vendor within agreed terms',
                'location' => 'Returned to Vendor',
                'handover_to' => null,
                'handed_out_at' => null,
            ]);

            // Decrement active stock if it was previously in_stock or out
            if (in_array($previousStatus, ['in_stock', 'out'], true)) {
                $stock = InventoryStock::where('variant_id', $unit->variant_id)->first();
                if ($stock && $stock->quantity_on_hand > 0) {
                    $stock->decrement('quantity_on_hand', 1);
                }
            }

            // Handle debts linked to this unit:
            // 1. Cancel any remaining unpaid payable obligations
            // 2. If the store ALREADY paid real money/wire to the vendor for this unit,
            //    the vendor now owes us a REFUND (open receivable) for that paid amount!
            $unitPayables = Debt::where('reference_id', $unit->id)
                ->where('type', 'payable')
                ->get();

            $totalRefundOwed = 0.0;

            foreach ($unitPayables as $debt) {
                $realPaidAmount = (float) $debt->payments()
                    ->where(function ($q) {
                        $q->whereNull('reference_number')
                            ->orWhere('reference_number', '!=', 'RETURN-TO-VENDOR');
                    })
                    ->sum('amount');

                if ($realPaidAmount > 0) {
                    $totalRefundOwed += $realPaidAmount;
                }

                if ($debt->remaining_amount > 0) {
                    DebtPayment::create([
                        'tenant_id' => $unit->tenant_id,
                        'debt_id' => $debt->id,
                        'amount' => (float) $debt->remaining_amount,
                        'payment_date' => now(),
                        'reference_number' => 'RETURN-TO-VENDOR',
                        'notes' => 'Device returned to vendor, canceling payable obligation',
                    ]);

                    $debt->update([
                        'paid_amount' => $debt->original_amount,
                        'remaining_amount' => 0.0,
                        'status' => 'settled',
                    ]);
                }
            }

            if ($totalRefundOwed > 0 && $unit->supplier_contact_id) {
                $pName = $unit->variant?->product?->name ?? 'Device';
                $sn = $unit->imei_or_serial ? " (SN: {$unit->imei_or_serial})" : '';

                Debt::create([
                    'tenant_id' => $unit->tenant_id,
                    'contact_id' => $unit->supplier_contact_id,
                    'type' => 'receivable',
                    'reference_type' => 'vendor_return_refund',
                    'reference_id' => $unit->id,
                    'original_amount' => $totalRefundOwed,
                    'paid_amount' => 0.0,
                    'remaining_amount' => $totalRefundOwed,
                    'due_date' => now()->addDays(7),
                    'status' => 'open',
                    'notes' => "Refund owed by vendor for returned device: {$pName}{$sn}. Device was previously paid for and returned.",
                ]);
            }

            AuditLog::record(
                action: 'returned_to_vendor',
                entityType: 'InventoryUnit',
                entityId: (string) $unit->id,
                newValues: [
                    'imei_or_serial' => $unit->imei_or_serial,
                    'vendor' => $unit->supplier?->name,
                    'return_reason' => $unit->return_reason,
                ]
            );
        });

        return response()->json([
            'success' => true,
            'message' => "Item successfully returned to {$vendorName} and removed from shop inventory.",
            'data' => $unit->fresh()->load(['variant.product', 'supplier']),
        ]);
    }

    /**
     * Receive a unit back from the vendor (same IMEI fixed).
     * Can either deliver back to the waiting customer (status -> sold)
     * or restock to shop shelf (status -> in_stock).
     */
    public function receiveFromVendor(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only store owners can process vendor intakes.',
            ], 403);
        }

        $unit = InventoryUnit::with([
            'variant.product',
            'supplier',
            'salesOrderItem.salesOrder.customer',
        ])->findOrFail($id);

        if ($unit->status !== 'returned_to_vendor') {
            return response()->json([
                'success' => false,
                'message' => 'Only devices currently with a vendor can be received back.',
            ], 422);
        }

        $validated = $request->validate([
            'action' => ['required', 'string', 'in:deliver_to_customer,restock'],
            'condition' => ['nullable', 'string', 'max:50'],
            'battery_health' => ['nullable', 'integer', 'min:0', 'max:100'],
            'cycle_count' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string'],
            'new_selling_price' => ['nullable', 'numeric', 'min:0'],
            'imei_or_serial' => ['nullable', 'string', 'max:100'],
        ]);

        $action = $validated['action'];
        $targetImei = array_key_exists('imei_or_serial', $validated)
            ? (trim($validated['imei_or_serial'] ?? '') ?: null)
            : $unit->imei_or_serial;

        if ($action === 'restock' && ! empty($targetImei)) {
            $duplicate = InventoryUnit::where('tenant_id', $user->tenant_id)
                ->where('id', '!=', $unit->id)
                ->whereIn('status', ['in_stock', 'reserved', 'out'])
                ->where('imei_or_serial', $targetImei)
                ->with('variant.product')
                ->first();

            if ($duplicate) {
                $dupName = $duplicate->variant?->product?->name ?? 'another device';
                $dupSpec = array_filter([$duplicate->variant?->color, $duplicate->variant?->storage]);
                $dupDesc = $dupSpec ? "{$dupName} (" . implode(' ', $dupSpec) . ")" : $dupName;

                return response()->json([
                    'success' => false,
                    'message' => "Cannot restock device: IMEI/Serial '{$targetImei}' is already assigned to an active {$dupDesc} currently in shop stock. Please change or edit the IMEI before restocking.",
                ], 422);
            }
        }

        $now = now();

        \Illuminate\Support\Facades\DB::transaction(function () use ($unit, $validated, $action, $now) {
            $prevNotes = $unit->notes;
            $vendorName = $unit->supplier?->name ?? 'Vendor';

            if ($action === 'deliver_to_customer') {
                $status = 'sold';
                $location = 'With Customer';
                $appendNote = "Received fixed from {$vendorName} and delivered back to customer on " . $now->format('M d, Y') . ".";
                if (! empty($validated['notes'])) {
                    $appendNote .= " Note: {$validated['notes']}";
                }

                $salesOrderItem = $unit->salesOrderItem;
                if ($salesOrderItem && $salesOrderItem->salesOrder) {
                    $salesOrder = $salesOrderItem->salesOrder;
                    $orderAuditNote = "[Vendor Return " . $now->format('M d, Y H:i') . ": SN {$unit->imei_or_serial} repaired by {$vendorName} and delivered to customer.]";
                    $salesOrder->update([
                        'notes' => $salesOrder->notes ? "{$salesOrder->notes}\n{$orderAuditNote}" : $orderAuditNote,
                    ]);
                }
            } else {
                $status = 'in_stock';
                $location = 'Shop Counter';
                $appendNote = "Received fixed from {$vendorName} and restocked to shelf on " . $now->format('M d, Y') . ".";
                if (! empty($validated['notes'])) {
                    $appendNote .= " Note: {$validated['notes']}";
                }
            }

            $updateData = [
                'status' => $status,
                'location' => $location,
                'customer_waiting' => false,
                'customer_waiting_at' => null,
                'is_repaired' => true,
                'condition' => $validated['condition'] ?? $unit->condition,
                'notes' => $prevNotes ? "{$prevNotes} | {$appendNote}" : $appendNote,
            ];

            if (array_key_exists('battery_health', $validated)) {
                $updateData['battery_health'] = $validated['battery_health'];
            }
            if (array_key_exists('cycle_count', $validated)) {
                $updateData['cycle_count'] = $validated['cycle_count'];
            }
            if (! empty($validated['new_selling_price'])) {
                $updateData['selling_price'] = $validated['new_selling_price'];
            }
            if (array_key_exists('imei_or_serial', $validated)) {
                $updateData['imei_or_serial'] = $targetImei;
            }

            $unit->update($updateData);

            (new \App\Actions\SynchronizeInventoryStockAction())->execute();

            AuditLog::record(
                action: 'received_from_vendor',
                entityType: 'InventoryUnit',
                entityId: (string) $unit->id,
                newValues: [
                    'imei_or_serial' => $unit->imei_or_serial,
                    'vendor' => $vendorName,
                    'action' => $action,
                    'status' => $status,
                ]
            );
        });

        $msg = $action === 'deliver_to_customer'
            ? 'Device received fixed from vendor and marked as delivered to customer.'
            : 'Device received fixed from vendor and restocked back to active shop inventory.';

        return response()->json([
            'success' => true,
            'message' => $msg,
            'data' => $unit->fresh()->load(['variant.product', 'supplier', 'salesOrderItem.salesOrder.customer']),
        ]);
    }

    /**
     * Process a vendor replacement swap when vendor provides a DIFFERENT IMEI.
     * Can either deliver replacement to waiting customer (automatically updating sales order and warranty)
     * or put the replacement unit in shop stock.
     */
    public function vendorSwap(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only store owners can process vendor replacement swaps.',
            ], 403);
        }

        $oldUnit = InventoryUnit::with([
            'variant.product',
            'supplier',
            'salesOrderItem.salesOrder.customer',
        ])->findOrFail($id);

        if ($oldUnit->status !== 'returned_to_vendor') {
            return response()->json([
                'success' => false,
                'message' => 'Only devices currently with a vendor can be processed for vendor replacement.',
            ], 422);
        }

        $validated = $request->validate([
            'replacement_imei' => ['required', 'string', 'max:100'],
            'action' => ['required', 'string', 'in:deliver_to_customer,restock'],
            'condition' => ['nullable', 'string', 'max:50'],
            'battery_health' => ['nullable', 'integer', 'min:0', 'max:100'],
            'cycle_count' => ['nullable', 'integer', 'min:0'],
            'sim_type' => ['nullable', 'string', 'in:physical,esim,dual,na'],
            'notes' => ['nullable', 'string'],
            'new_selling_price' => ['nullable', 'numeric', 'min:0'],
        ]);

        $replacementImei = trim($validated['replacement_imei']);

        // Check for active IMEI conflict in tenant
        $exists = InventoryUnit::where('tenant_id', $user->tenant_id)
            ->whereIn('status', ['in_stock', 'reserved', 'out'])
            ->where('imei_or_serial', $replacementImei)
            ->exists();

        if ($exists) {
            return response()->json([
                'success' => false,
                'message' => "The replacement IMEI/Serial number '{$replacementImei}' is already in active shop inventory.",
            ], 422);
        }

        $action = $validated['action'];
        $now = now();
        $vendorName = $oldUnit->supplier?->name ?? 'Vendor';
        $replacementUnit = null;

        \Illuminate\Support\Facades\DB::transaction(function () use ($oldUnit, $validated, $replacementImei, $action, $now, $vendorName, $user, &$replacementUnit) {
            $newStatus = $action === 'deliver_to_customer' ? 'sold' : 'in_stock';
            $newLocation = $action === 'deliver_to_customer' ? 'With Customer' : 'Shop Counter';

            $replacementNote = "Received from {$vendorName} as warranty replacement for defective SN {$oldUnit->imei_or_serial} on " . $now->format('M d, Y') . ".";
            if (! empty($validated['notes'])) {
                $replacementNote .= " Note: {$validated['notes']}";
            }

            // 1. Create the new replacement unit with exact same cost basis and supplier linkage
            $replacementUnit = InventoryUnit::create([
                'tenant_id' => $user->tenant_id,
                'variant_id' => $oldUnit->variant_id,
                'imei_or_serial' => $replacementImei,
                'battery_health' => $validated['battery_health'] ?? $oldUnit->battery_health,
                'cycle_count' => $validated['cycle_count'] ?? null,
                'sim_type' => $validated['sim_type'] ?? ($oldUnit->sim_type ?? 'physical'),
                'condition' => $validated['condition'] ?? 'new',
                'cost_basis' => $oldUnit->cost_basis,
                'selling_price' => $validated['new_selling_price'] ?? $oldUnit->selling_price,
                'status' => $newStatus,
                'location' => $newLocation,
                'source_type' => $oldUnit->source_type ?? 'consignment',
                'supplier_contact_id' => $oldUnit->supplier_contact_id,
                'is_swapped' => true,
                'swapped_at' => $now,
                'swapped_from_unit_id' => $oldUnit->id,
                'notes' => $replacementNote,
                'sold_at' => $action === 'deliver_to_customer' ? $now : null,
            ]);

            // 2. If delivering to waiting customer, transfer sales order item to the new replacement unit
            if ($action === 'deliver_to_customer' && $oldUnit->salesOrderItem) {
                $salesOrderItem = $oldUnit->salesOrderItem;
                $salesOrder = $salesOrderItem->salesOrder;

                $salesOrderItem->update([
                    'inventory_unit_id' => $replacementUnit->id,
                ]);

                $replacementUnit->update([
                    'swapped_sales_order_id' => $salesOrder?->id,
                ]);

                if ($salesOrder) {
                    $orderAuditNote = "[Vendor Warranty Swap " . $now->format('M d, Y H:i') . ": {$vendorName} replaced defective SN {$oldUnit->imei_or_serial} with new SN {$replacementImei}. Delivered to customer under Order #{$salesOrder->order_number}.]";
                    $salesOrder->update([
                        'notes' => $salesOrder->notes ? "{$salesOrder->notes}\n{$orderAuditNote}" : $orderAuditNote,
                    ]);
                }
            }

            // 3. Mark old unit as permanently replaced by vendor
            $oldUnitCloseNote = "Replaced by {$vendorName} on " . $now->format('M d, Y') . " with replacement SN {$replacementImei}.";
            $oldUnit->update([
                'customer_waiting' => false,
                'customer_waiting_at' => null,
                'swapped_replacement_unit_id' => $replacementUnit->id,
                'notes' => $oldUnit->notes ? "{$oldUnit->notes} | {$oldUnitCloseNote}" : $oldUnitCloseNote,
            ]);

            // 4. Synchronize inventory stock levels
            (new \App\Actions\SynchronizeInventoryStockAction())->execute();

            // 5. Audit Log
            AuditLog::record(
                action: 'vendor_device_swap',
                entityType: 'InventoryUnit',
                entityId: (string) $replacementUnit->id,
                newValues: [
                    'old_imei' => $oldUnit->imei_or_serial,
                    'replacement_imei' => $replacementImei,
                    'vendor' => $vendorName,
                    'action' => $action,
                ]
            );
        });

        $msg = $action === 'deliver_to_customer'
            ? "Vendor replacement SN {$replacementImei} created and delivered to customer. Sales order receipt and warranty updated."
            : "Vendor replacement SN {$replacementImei} created and added to shop shelf stock.";

        return response()->json([
            'success' => true,
            'message' => $msg,
            'data' => [
                'old_unit' => $oldUnit->fresh(['variant.product', 'supplier']),
                'replacement_unit' => $replacementUnit ? $replacementUnit->fresh(['variant.product', 'supplier']) : null,
            ],
        ]);
    }

    /**
     * Swap a sold defective unit with an in-stock replacement unit under warranty.
     * Preserves monetary consistency: 0 payment adjustment, updates active device on sales order,
     * places defective unit in repair/inspection with swap history.
     */
    public function swapUnit(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Device swaps are restricted to store owners/administrators.',
            ], 403);
        }

        $oldUnit = InventoryUnit::with(['variant.product', 'salesOrderItem.salesOrder'])->findOrFail($id);

        if ($oldUnit->status !== 'sold') {
            return response()->json([
                'success' => false,
                'message' => 'Only currently sold devices can be swapped.',
            ], 422);
        }

        $salesOrderItem = $oldUnit->salesOrderItem;
        if (! $salesOrderItem || ! $salesOrderItem->salesOrder) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot swap a unit that has no linked sales order.',
            ], 422);
        }

        $validated = $request->validate([
            'replacement_unit_id' => ['required', 'uuid', 'exists:inventory_units,id'],
            'swap_reason' => ['required', 'string', 'max:500'],
            'destination' => ['nullable', 'string', 'in:repair,in_stock'],
            'condition' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string', 'max:500'],
            'allow_cost_difference' => ['nullable', 'boolean'],
        ]);

        $replacementUnit = InventoryUnit::with('variant.product')->findOrFail($validated['replacement_unit_id']);

        if ($replacementUnit->status !== 'in_stock') {
            return response()->json([
                'success' => false,
                'message' => 'The replacement device must be currently in stock on the shop shelf.',
            ], 422);
        }

        if ($replacementUnit->id === $oldUnit->id) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot swap a device with itself.',
            ], 422);
        }

        // Cost matching verification: prevent monetary discrepancy unless explicitly authorized
        $oldCost = $oldUnit->cost_basis !== null ? (float) $oldUnit->cost_basis : ($salesOrderItem->unit_cost !== null ? (float) $salesOrderItem->unit_cost : null);
        $replacementCost = $replacementUnit->cost_basis !== null ? (float) $replacementUnit->cost_basis : null;

        if ($oldCost !== null && $replacementCost !== null && abs($oldCost - $replacementCost) > 0.01) {
            if (! $request->boolean('allow_cost_difference')) {
                return response()->json([
                    'success' => false,
                    'message' => "Cost value mismatch: Defective device cost basis (" . number_format($oldCost) . " ETB) does not match replacement device cost basis (" . number_format($replacementCost) . " ETB). Swapping devices with different costs causes inventory valuation distortion.",
                ], 422);
            }
        }

        $destination = $validated['destination'] ?? 'repair';
        $salesOrder = $salesOrderItem->salesOrder;

        DB::transaction(function () use ($oldUnit, $replacementUnit, $salesOrderItem, $salesOrder, $validated, $destination) {
            $now = now();
            $oldImei = $oldUnit->imei_or_serial ?? 'N/A';
            $newImei = $replacementUnit->imei_or_serial ?? 'N/A';

            // 1. Move old defective unit to repair (or in_stock)
            $oldStatus = $destination === 'in_stock' ? 'in_stock' : 'returned';
            $oldLocation = $destination === 'in_stock' ? 'Shop Counter' : 'Repair & Inspection Shelf';
            $swapNote = "Swapped for IMEI {$newImei} on " . $now->format('M d, Y') . ". Reason: {$validated['swap_reason']}";

            $oldUnit->update([
                'status' => $oldStatus,
                'location' => $oldLocation,
                'returned_at' => $now,
                'return_reason' => "[Warranty Swap] {$validated['swap_reason']}",
                'is_swapped' => true,
                'swapped_at' => $now,
                'swapped_sales_order_id' => $salesOrder->id,
                'swapped_replacement_unit_id' => $replacementUnit->id,
                'condition' => $validated['condition'] ?? $oldUnit->condition,
                'notes' => $oldUnit->notes ? "{$oldUnit->notes} | {$swapNote}" : $swapNote,
            ]);

            // 2. Mark replacement unit as sold
            $replacementNote = "Issued as warranty replacement for IMEI {$oldImei} on " . $now->format('M d, Y');
            $replacementUnit->update([
                'status' => 'sold',
                'sold_at' => $now,
                'location' => 'With Customer',
                'is_swapped' => true,
                'swapped_at' => $now,
                'swapped_from_unit_id' => $oldUnit->id,
                'swapped_sales_order_id' => $salesOrder->id,
                'notes' => $replacementUnit->notes ? "{$replacementUnit->notes} | {$replacementNote}" : $replacementNote,
            ]);

            // 3. Update SalesOrderItem to point to the replacement unit
            // If replacement unit has a cost basis, update unit_cost & profit for precise COGS
            $salesOrderItemUpdate = [
                'inventory_unit_id' => $replacementUnit->id,
            ];
            if ($replacementUnit->cost_basis !== null) {
                $cost = (float) $replacementUnit->cost_basis;
                $price = (float) $salesOrderItem->unit_price;
                $salesOrderItemUpdate['unit_cost'] = $cost;
                $salesOrderItemUpdate['profit'] = $price - $cost;
            }
            $salesOrderItem->update($salesOrderItemUpdate);

            // 4. Append audit note to SalesOrder
            $orderAuditNote = "[Warranty Swap " . $now->format('M d, Y H:i') . ": SN {$oldImei} replaced with SN {$newImei}. Reason: {$validated['swap_reason']}]";
            $salesOrder->update([
                'notes' => $salesOrder->notes ? "{$salesOrder->notes}\n{$orderAuditNote}" : $orderAuditNote,
            ]);

            // 5. Synchronize inventory stock levels
            (new \App\Actions\SynchronizeInventoryStockAction())->execute();

            // 6. Record Audit Log
            AuditLog::record(
                action: 'device_warranty_swap',
                entityType: 'SalesOrder',
                entityId: (string) $salesOrder->id,
                newValues: [
                    'order_number' => $salesOrder->order_number,
                    'old_unit_id' => $oldUnit->id,
                    'old_imei' => $oldImei,
                    'replacement_unit_id' => $replacementUnit->id,
                    'replacement_imei' => $newImei,
                    'reason' => $validated['swap_reason'],
                    'destination' => $destination,
                ]
            );
        });

        return response()->json([
            'success' => true,
            'message' => "Device swap recorded. Defective device moved to {$destination}, replacement device issued to Order #{$salesOrder->order_number}.",
            'data' => [
                'old_unit' => $oldUnit->fresh(['variant.product', 'swappedReplacementUnit.variant.product', 'swappedSalesOrder']),
                'replacement_unit' => $replacementUnit->fresh(['variant.product', 'swappedFromUnit.variant.product', 'swappedSalesOrder']),
            ],
        ]);
    }

    public function stockSummary(Request $request): JsonResponse
    {
        $inStockUnits = InventoryUnit::with('variant.product')
            ->where('status', 'in_stock')
            ->get();

        $quantityStocks = InventoryStock::with('variant.product')->get();

        /** @var User|null $user */
        $user = $request->user();
        $canViewCost = $user ? $user->canViewCosts() : false;

        return response()->json([
            'success' => true,
            'data' => [
                'serialized_units_count' => $inStockUnits->count(),
                'serialized_cost_total' => $canViewCost ? $inStockUnits->sum('cost_basis') : null,
                'quantity_items_count' => $quantityStocks->sum('quantity_on_hand'),
                'quantity_cost_total' => $canViewCost ? $quantityStocks->sum(fn ($s) => $s->quantity_on_hand * (float) $s->average_cost) : null,
            ],
        ]);
    }
}
