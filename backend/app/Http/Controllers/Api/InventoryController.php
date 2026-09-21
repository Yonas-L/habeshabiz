<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\InventoryStock;
use App\Models\InventoryUnit;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryController extends Controller
{
    public function units(Request $request): JsonResponse
    {
        $query = InventoryUnit::with(['variant.product.categoryRel', 'supplier']);

        if ($request->filled('source_type') && $request->source_type !== 'all') {
            $query->where('source_type', $request->source_type);
        }

        if ($request->status === 'vendor_stock') {
            $query->where('status', 'in_stock')->where('source_type', 'consignment');
        } elseif ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        } elseif (! $request->filled('status')) {
            $query->where('status', 'in_stock');
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
            'out' => InventoryUnit::where('status', 'out')->count(),
            'sold' => InventoryUnit::where('status', 'sold')->count(),
            'returned' => InventoryUnit::whereIn('status', ['returned', 'returned_to_vendor'])->count(),
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

        $createdUnits = [];
        $costBasis = (float) $validated['cost_basis'];

        \Illuminate\Support\Facades\DB::transaction(function () use ($validated, $variant, $costBasis, &$createdUnits) {
            $imeisList = [];
            if (! empty($validated['imeis']) && is_array($validated['imeis'])) {
                $imeisList = array_values(array_filter(array_map('trim', $validated['imeis'])));
            } elseif (! empty($validated['imei_or_serial'])) {
                // If comma/newline separated string entered in imei_or_serial
                $parsed = preg_split('/[\r\n,]+/', trim($validated['imei_or_serial']));
                $imeisList = array_values(array_filter(array_map('trim', $parsed)));
            }

            $countToCreate = max(count($imeisList), (int) ($validated['quantity'] ?? 1));

            for ($i = 0; $i < $countToCreate; $i++) {
                $imei = $imeisList[$i] ?? (! empty($imeisList) ? null : ($validated['imei_or_serial'] ?? null));

                $unit = InventoryUnit::create([
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
            }

            // Sync InventoryStock record
            $stock = InventoryStock::firstOrCreate(
                ['variant_id' => $variant->id],
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
     * Mark an in-stock unit as taken out by a staff member or broker to sell.
     */
    public function handoverUnit(Request $request, string $id): JsonResponse
    {
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
        ]);

        $unit->update([
            'status' => 'out',
            'handover_to' => $validated['handover_to'],
            'handed_out_at' => now(),
            'location' => $validated['location'] ?? "Out with {$validated['handover_to']}",
            'notes' => ! empty($validated['notes'])
                ? ($unit->notes ? "{$unit->notes} | {$validated['notes']}" : $validated['notes'])
                : $unit->notes,
        ]);

        AuditLog::record(
            action: 'unit_handover',
            entityType: 'InventoryUnit',
            entityId: (string) $unit->id,
            newValues: [
                'imei_or_serial' => $unit->imei_or_serial,
                'handover_to' => $validated['handover_to'],
                'location' => $unit->location,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => "Item handed out to {$validated['handover_to']} for sale.",
            'data' => $unit->load('variant.product'),
        ]);
    }

    /**
     * Restock an unsold item that was out with staff/broker back to shop shelf.
     * Note: Sold items are NOT restocked directly; they must go through customer return.
     */
    public function restockUnit(Request $request, string $id): JsonResponse
    {
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

        $unit->update([
            'status' => 'in_stock',
            'handover_to' => null,
            'handed_out_at' => null,
            'location' => 'Shop Counter',
            'sold_at' => null,
        ]);

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
     * Process a return of a sold item by a customer.
     * Requires a reason and places unit in returned/repair tracking.
     */
    public function customerReturn(Request $request, string $id): JsonResponse
    {
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
        ]);

        $unit->update([
            'status' => 'returned',
            'return_reason' => $validated['return_reason'],
            'returned_at' => now(),
            'condition' => $validated['condition'] ?? $unit->condition,
            'location' => 'Repair & Inspection Shelf',
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
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Device returned by customer. Moved to Repair & Inspection shelf.',
            'data' => $unit->load('variant.product'),
        ]);
    }

    /**
     * Mark a returned/repaired unit as repaired and restock it to shop shelf.
     */
    public function repairAndRestock(Request $request, string $id): JsonResponse
    {
        $unit = InventoryUnit::findOrFail($id);

        if ($unit->status !== 'returned') {
            return response()->json([
                'success' => false,
                'message' => 'Only returned items can be processed as repaired & restocked.',
            ], 422);
        }

        $validated = $request->validate([
            'condition' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string'],
        ]);

        $unit->update([
            'status' => 'in_stock',
            'condition' => $validated['condition'] ?? $unit->condition,
            'location' => 'Shop Counter',
            'notes' => ! empty($validated['notes'])
                ? ($unit->notes ? "{$unit->notes} | Repair note: {$validated['notes']}" : "Repair note: {$validated['notes']}")
                : $unit->notes,
        ]);

        AuditLog::record(
            action: 'unit_repaired_restocked',
            entityType: 'InventoryUnit',
            entityId: (string) $unit->id,
            newValues: [
                'imei_or_serial' => $unit->imei_or_serial,
                'condition' => $unit->condition,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Device repaired and restocked back to shop shelf.',
            'data' => $unit->load('variant.product'),
        ]);
    }

    /**
     * Return an unsold vendor consignment item back to the broker/seller.
     * Decrements stock and marks unit as returned_to_vendor.
     */
    public function returnToVendor(Request $request, string $id): JsonResponse
    {
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
