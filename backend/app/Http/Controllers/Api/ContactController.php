<?php

namespace App\Http\Controllers\Api;

use App\Actions\GeneratePartnerStatementAction;
use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Scopes\TenantScope;
use App\Services\PdfGeneratorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ContactController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Contact::query()
            ->with('debts')
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
        $tenantId = TenantScope::getActiveTenantId() ?? $request->user()?->tenant_id;

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => [
                'nullable',
                'string',
                'max:50',
                Rule::unique('contacts', 'phone')
                    ->where(fn ($query) => $query->where('tenant_id', $tenantId)->whereNull('deleted_at')),
            ],
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
        $tenantId = TenantScope::getActiveTenantId() ?? $contact->tenant_id;

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'phone' => [
                'nullable',
                'string',
                'max:50',
                Rule::unique('contacts', 'phone')
                    ->where(fn ($query) => $query->where('tenant_id', $tenantId)->whereNull('deleted_at'))
                    ->ignore($contact->id),
            ],
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
        $contact = Contact::findOrFail($id);

        // Soft-delete: sets deleted_at, row stays in DB for FK integrity.
        // All historical debts, sales orders, brokered items, and inventory
        // records continue to resolve the partner name via withTrashed().
        $contact->update(['is_active' => false]);
        $contact->delete();

        return response()->json([
            'success' => true,
            'message' => "Partner '{$contact->name}' removed successfully. All historical records are preserved.",
        ]);
    }

    public function statement(Request $request, string $id, GeneratePartnerStatementAction $action): JsonResponse
    {
        $contact = Contact::findOrFail($id);
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');

        if (empty($contact->statement_token)) {
            $contact->update(['statement_token' => \Illuminate\Support\Str::random(32)]);
        }

        $data = $action->execute($contact, $startDate, $endDate);

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    public function publicStatement(Request $request, string $token, GeneratePartnerStatementAction $action): JsonResponse
    {
        $contact = Contact::withoutGlobalScopes()
            ->where('statement_token', $token)
            ->firstOrFail();

        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');

        TenantScope::setForcedTenantId($contact->tenant_id);

        try {
            $data = $action->execute($contact, $startDate, $endDate);
        } finally {
            TenantScope::setForcedTenantId(null);
        }

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    public function statementPdf(Request $request, string $id, PdfGeneratorService $pdfService): \Symfony\Component\HttpFoundation\Response
    {
        $contact = Contact::findOrFail($id);
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        $accountsParam = $request->query('accounts');
        $selectedAccountIds = [];
        if ($accountsParam && $accountsParam !== 'none') {
            $selectedAccountIds = explode(',', $accountsParam);
        }

        $forceDownload = $request->query('download', '1') === '1';

        return $pdfService->generateVendorStatement($contact, $startDate, $endDate, $selectedAccountIds, $forceDownload)->toResponse($request);
    }

    public function publicStatementPdf(Request $request, string $token, PdfGeneratorService $pdfService): \Symfony\Component\HttpFoundation\Response
    {
        $contact = Contact::withoutGlobalScopes()
            ->where('statement_token', $token)
            ->firstOrFail();

        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        $accountsParam = $request->query('accounts');
        $selectedAccountIds = [];
        if ($accountsParam && $accountsParam !== 'none') {
            $selectedAccountIds = explode(',', $accountsParam);
        }

        $forceDownload = $request->query('download', '1') === '1';

        TenantScope::setForcedTenantId($contact->tenant_id);

        try {
            return $pdfService->generateVendorStatement($contact, $startDate, $endDate, $selectedAccountIds, $forceDownload)->toResponse($request);
        } finally {
            TenantScope::setForcedTenantId(null);
        }
    }
}
