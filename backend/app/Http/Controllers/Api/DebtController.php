<?php

namespace App\Http\Controllers\Api;

use App\Actions\SettleDebtPaymentAction;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Contact;
use App\Models\Debt;
use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use App\Scopes\TenantScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DebtController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Debt::with(['contact', 'payments.financialAccount']);

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        } else {
            // Default show open and partially paid debts
            $query->whereIn('status', ['open', 'partially_paid']);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->whereHas('contact', fn ($cq) => $cq->where('name', 'ilike', "%{$search}%")->orWhere('phone', 'ilike', "%{$search}%"))
                  ->orWhere('notes', 'ilike', "%{$search}%");
            });
        }

        $debts = $query->orderByDesc('created_at')->get();

        return response()->json([
            'success' => true,
            'data' => $debts,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Recording manual debt or credit records is restricted to store owners.',
            ], 403);
        }

        $validated = $request->validate([
            'type' => ['required', 'in:receivable,payable'],
            'contact_id' => ['nullable', 'exists:contacts,id'],
            'contact_name' => ['required_without:contact_id', 'nullable', 'string', 'max:255'],
            'contact_phone' => ['nullable', 'string', 'max:50'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'due_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'disburse_account_id' => ['nullable', 'exists:financial_accounts,id'],
        ]);

        $debt = DB::transaction(function () use ($validated, $user) {
            $tenantId = TenantScope::getActiveTenantId() ?? $user->tenant_id;

            // Resolve or create contact
            $contactId = $validated['contact_id'] ?? null;
            $contactPhone = ! empty($validated['contact_phone']) ? trim($validated['contact_phone']) : null;
            $contactName = ! empty($validated['contact_name']) ? trim($validated['contact_name']) : null;

            if (! $contactId) {
                $existingContact = null;
                if ($contactPhone) {
                    $existingContact = Contact::where('tenant_id', $tenantId)
                        ->where('phone', $contactPhone)
                        ->first();
                }
                if (! $existingContact && $contactName) {
                    $existingContact = Contact::where('tenant_id', $tenantId)
                        ->where('name', $contactName)
                        ->first();
                }

                $defaultRole = $validated['type'] === 'receivable' ? 'customer' : 'supplier';
                if ($existingContact) {
                    $contactId = $existingContact->id;
                    $contact = $existingContact;
                    $roles = $existingContact->roles ?? [];
                    if (! in_array($defaultRole, $roles, true)) {
                        $roles[] = $defaultRole;
                        $existingContact->roles = $roles;
                        $existingContact->save();
                    }
                } else {
                    $contact = Contact::create([
                        'tenant_id' => $tenantId,
                        'name' => $contactName ?: 'Contact ('.$contactPhone.')',
                        'phone' => $contactPhone,
                        'roles' => [$defaultRole],
                        'is_active' => true,
                    ]);
                    $contactId = $contact->id;
                }
            } else {
                $contact = Contact::find($contactId);
            }

            $amount = (float) $validated['amount'];
            $type = $validated['type'];

            $debt = Debt::create([
                'tenant_id' => $tenantId,
                'contact_id' => $contactId,
                'type' => $type,
                'reference_type' => 'direct_credit',
                'reference_id' => null,
                'original_amount' => $amount,
                'paid_amount' => 0,
                'remaining_amount' => $amount,
                'due_date' => $validated['due_date'] ?? null,
                'status' => 'open',
                'notes' => $validated['notes'] ?? null,
            ]);

            // Handle immediate cash disbursement or borrowing deposit if requested
            if (! empty($validated['disburse_account_id'])) {
                $account = FinancialAccount::findOrFail($validated['disburse_account_id']);
                $contactName = $contact ? $contact->name : 'Contact';

                if ($type === 'receivable') {
                    // Money disbursed/lent from our account to the borrower
                    if ((float) $account->current_balance < $amount) {
                        throw \Illuminate\Validation\ValidationException::withMessages([
                            'disburse_account_id' => ["Insufficient balance in account '{$account->name}'."],
                        ]);
                    }
                    $account->decrement('current_balance', $amount);

                    FinancialTransaction::create([
                        'tenant_id' => $tenantId,
                        'transaction_number' => 'TXN-'.strtoupper(Str::random(8)),
                        'source_account_id' => $account->id,
                        'type' => 'loan_disbursement',
                        'amount' => $amount,
                        'contact_id' => $contactId,
                        'description' => "Cash lent/disbursed to {$contactName}".(! empty($validated['notes']) ? ": {$validated['notes']}" : ''),
                        'date' => now(),
                        'created_by' => $user->id,
                    ]);
                } else {
                    // Borrowed funds deposited into our account
                    $account->increment('current_balance', $amount);

                    FinancialTransaction::create([
                        'tenant_id' => $tenantId,
                        'transaction_number' => 'TXN-'.strtoupper(Str::random(8)),
                        'destination_account_id' => $account->id,
                        'type' => 'borrowed_funds',
                        'amount' => $amount,
                        'contact_id' => $contactId,
                        'description' => "Borrowed cash received from {$contactName}".(! empty($validated['notes']) ? ": {$validated['notes']}" : ''),
                        'date' => now(),
                        'created_by' => $user->id,
                    ]);
                }
            }

            AuditLog::record(
                action: 'manual_debt_created',
                entityType: 'Debt',
                entityId: $debt->id,
                newValues: [
                    'type' => $debt->type,
                    'contact' => $contact?->name,
                    'amount' => $debt->original_amount,
                    'due_date' => $debt->due_date,
                    'with_disbursement' => ! empty($validated['disburse_account_id']),
                ]
            );

            return $debt;
        });

        return response()->json([
            'success' => true,
            'message' => $debt->type === 'receivable'
                ? "Receivable obligation for {$debt->original_amount} ETB recorded."
                : "Payable obligation for {$debt->original_amount} ETB recorded.",
            'data' => $debt->load(['contact', 'payments.financialAccount']),
        ], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Editing debt records is restricted to store owners.',
            ], 403);
        }

        $debt = Debt::findOrFail($id);

        $validated = $request->validate([
            'due_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
            'contact_id' => ['nullable', 'exists:contacts,id'],
            'original_amount' => ['nullable', 'numeric', 'min:0.01'],
        ]);

        if (isset($validated['original_amount'])) {
            $newOriginal = (float) $validated['original_amount'];
            if ($newOriginal < (float) $debt->paid_amount) {
                return response()->json([
                    'success' => false,
                    'message' => "Original amount cannot be reduced below already settled payments ({$debt->paid_amount} ETB).",
                ], 422);
            }
            $debt->original_amount = $newOriginal;
            $debt->remaining_amount = max(0, $newOriginal - (float) $debt->paid_amount);
            $debt->status = $debt->remaining_amount <= 0 ? 'settled' : ($debt->paid_amount > 0 ? 'partially_paid' : 'open');
        }

        if (array_key_exists('due_date', $validated)) {
            $debt->due_date = $validated['due_date'];
        }
        if (array_key_exists('notes', $validated)) {
            $debt->notes = $validated['notes'];
        }
        if (! empty($validated['contact_id'])) {
            $debt->contact_id = $validated['contact_id'];
        }

        $debt->save();

        AuditLog::record(
            action: 'debt_updated',
            entityType: 'Debt',
            entityId: $debt->id,
            newValues: $validated
        );

        return response()->json([
            'success' => true,
            'message' => 'Debt record updated successfully.',
            'data' => $debt->fresh(['contact', 'payments.financialAccount']),
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Deleting debt records is restricted to store owners.',
            ], 403);
        }

        $debt = Debt::withCount('payments')->findOrFail($id);

        if ((float) $debt->paid_amount > 0 || $debt->payments_count > 0) {
            return response()->json([
                'success' => false,
                'message' => "Cannot delete debt with payments settled ({$debt->paid_amount} ETB paid). Settle or void payments first.",
            ], 422);
        }

        $debt->delete();

        AuditLog::record(
            action: 'debt_deleted',
            entityType: 'Debt',
            entityId: $id,
            oldValues: [
                'type' => $debt->type,
                'contact_id' => $debt->contact_id,
                'original_amount' => $debt->original_amount,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Debt record removed successfully.',
        ]);
    }

    public function settlePayment(Request $request, string $id, SettleDebtPaymentAction $action): JsonResponse
    {
        $debt = Debt::with('contact')->findOrFail($id);

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'financial_account_id' => ['required', 'exists:financial_accounts,id'],
            'payment_date' => ['nullable', 'date'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string'],
        ]);

        $payment = $action->execute($debt, $validated);

        return response()->json([
            'success' => true,
            'message' => 'Payment settled and financial accounts updated.',
            'data' => [
                'debt' => $debt->fresh(['contact', 'payments']),
                'payment' => $payment->load('financialAccount'),
            ],
        ]);
    }
}
