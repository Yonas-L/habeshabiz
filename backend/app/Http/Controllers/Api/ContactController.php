<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContactController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Contact::query()
            ->withCount(['debts', 'salesOrders', 'brokeredItems', 'suppliedUnits']);

        if ($request->filled('role')) {
            $role = $request->role;
            $query->whereJsonContains('roles', $role);
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                    ->orWhere('phone', 'ilike', "%{$search}%")
                    ->orWhere('alt_phone', 'ilike', "%{$search}%")
                    ->orWhere('email', 'ilike', "%{$search}%")
                    ->orWhere('notes', 'ilike', "%{$search}%");
            });
        }

        $contacts = $query->orderBy('name')->get();

        return response()->json([
            'success' => true,
            'data' => $contacts,
        ]);
    }

    public function show(string $id): JsonResponse
    {
        $contact = Contact::withCount(['debts', 'salesOrders', 'brokeredItems', 'suppliedUnits'])
            ->with([
                'debts' => fn ($q) => $q->latest()->limit(10),
                'brokeredItems' => fn ($q) => $q->with(['salesOrder', 'variant.product'])->latest()->limit(10),
            ])
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $contact,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'alt_phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email'],
            'roles' => ['required', 'array', 'min:1'],
            'notes' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $validated['is_active'] = $validated['is_active'] ?? true;

        $contact = Contact::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Partner / contact added successfully.',
            'data' => $contact->loadCount(['debts', 'salesOrders', 'brokeredItems', 'suppliedUnits']),
        ], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $contact = Contact::findOrFail($id);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'alt_phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email'],
            'roles' => ['sometimes', 'required', 'array', 'min:1'],
            'notes' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $contact->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Partner / contact updated successfully.',
            'data' => $contact->fresh()->loadCount(['debts', 'salesOrders', 'brokeredItems', 'suppliedUnits']),
        ]);
    }

    public function destroy(string $id): JsonResponse
    {
        $contact = Contact::withCount(['debts', 'salesOrders', 'brokeredItems', 'suppliedUnits'])
            ->findOrFail($id);

        $linkedCount = $contact->debts_count + $contact->sales_orders_count + $contact->brokered_items_count + $contact->supplied_units_count;

        if ($linkedCount > 0) {
            return response()->json([
                'success' => false,
                'message' => "Cannot remove partner '{$contact->name}' because they have {$linkedCount} associated transaction/inventory record(s). Deactivate them instead to preserve financial history.",
                'can_deactivate' => true,
            ], 422);
        }

        $contact->delete();

        return response()->json([
            'success' => true,
            'message' => "Partner '{$contact->name}' removed successfully.",
        ]);
    }
}
