<?php

namespace App\Http\Controllers\Api;

use App\Actions\RecordSaleAction;
use App\Http\Controllers\Controller;
use App\Models\SalesOrder;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SaleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = SalesOrder::with([
            'customer',
            'salesperson',
            'financialAccount',
            'items.variant.product',
            'items.inventoryUnit',
            'items.vendorContact',
        ]);

        /** @var User|null $user */
        $user = $request->user();
        $isOwner = $user ? $user->isOwner() : false;
        $canViewCost = $user ? $user->canViewCosts() : false;

        // Salespeople only see and track what they sold or was sold on their behalf
        if (! $isOwner && $user) {
            $query->where('salesperson_id', $user->id);
        }

        if ($request->filled('payment_status')) {
            $query->where('payment_status', $request->payment_status);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('order_number', 'ilike', "%{$search}%")
                    ->orWhereHas('customer', fn ($cq) => $cq->where('name', 'ilike', "%{$search}%"));
            });
        }

        $sales = $query->latest('order_date')->paginate(20);

        // Hide profit and unit_cost if not permitted
        if (! $canViewCost) {
            $sales->getCollection()->transform(function ($order) {
                foreach ($order->items as $item) {
                    unset($item->unit_cost, $item->profit, $item->vendor_cost);
                }

                return $order;
            });
        }

        return response()->json([
            'success' => true,
            'data' => $sales->items(),
            'pagination' => [
                'current_page' => $sales->currentPage(),
                'last_page' => $sales->lastPage(),
                'total' => $sales->total(),
            ],
        ]);
    }

    public function store(Request $request, RecordSaleAction $action): JsonResponse
    {
        $validated = $request->validate([
            'order_number' => ['nullable', 'string', 'max:50', 'unique:sales_orders,order_number'],
            'customer_id' => ['nullable', 'exists:contacts,id'],
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
            'items.*.sourcing_type' => ['nullable', 'string', 'in:internal_stock,brokered_neighbour'],
            'items.*.vendor_contact_id' => ['nullable', 'exists:contacts,id'],
            'items.*.vendor_cost' => ['nullable', 'numeric', 'min:0'],
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
}
