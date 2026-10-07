<?php

namespace App\Http\Controllers\Api;

use App\Actions\SettleDebtPaymentAction;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Contact;
use App\Models\Debt;
use App\Models\DebtPayment;
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
        $tenantId = TenantScope::getActiveTenantId() ?? $request->user()?->tenant_id;
        if ($tenantId) {
            Debt::reconcileAllMutualDebtsForTenant($tenantId);
        }

        $query = Debt::with(['contact.debts', 'payments.financialAccount']);

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
            'cash_flow_direction' => ['nullable', 'string', 'in:in,out,none'],
            'fee' => ['nullable', 'numeric', 'min:0'],
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
                    $phoneDigits = preg_replace('/[^\d]/', '', $contactPhone);
                    $suffix = substr($phoneDigits, -9);
                    $existingContact = Contact::where('tenant_id', $tenantId)
                        ->where(function ($q) use ($contactPhone, $suffix) {
                            $q->where('phone', $contactPhone);
                            if (strlen($suffix) >= 9) {
                                $q->orWhere('phone', 'like', "%{$suffix}");
                            }
                        })
                        ->first();
                }
                if (! $existingContact && $contactName) {
                    $existingContact = Contact::where('tenant_id', $tenantId)
                        ->where('name', 'ilike', $contactName)
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
            $hasCashMovement = ! empty($validated['disburse_account_id']);
            $direction = $validated['cash_flow_direction'] ?? ($type === 'receivable' ? 'out' : 'in');

            $account = null;
            if ($hasCashMovement) {
                $account = FinancialAccount::where('tenant_id', $tenantId)->findOrFail($validated['disburse_account_id']);
            }

            // Determine if this cash movement immediately settles the obligation:
            // Payable + Cash Out = immediate vendor payout / bill paid -> SETTLED
            // Receivable + Cash In = immediate customer deposit / cash received -> SETTLED
            // Otherwise = open obligation (pure credit, or lent loan, or borrowed fund)
            $isImmediateSettlement = false;
            if ($hasCashMovement) {
                if ($type === 'payable' && $direction === 'out') {
                    $isImmediateSettlement = true;
                } elseif ($type === 'receivable' && $direction === 'in') {
                    $isImmediateSettlement = true;
                }
            }

            $paidAmount = $isImmediateSettlement ? $amount : 0.0;
            $remainingAmount = $isImmediateSettlement ? 0.0 : $amount;
            $status = $isImmediateSettlement ? 'settled' : 'open';

            $debt = Debt::create([
                'tenant_id' => $tenantId,
                'contact_id' => $contactId,
                'type' => $type,
                'reference_type' => 'direct_credit',
                'reference_id' => null,
                'original_amount' => $amount,
                'paid_amount' => $paidAmount,
                'remaining_amount' => $remainingAmount,
                'due_date' => $isImmediateSettlement ? now() : ($validated['due_date'] ?? null),
                'status' => $status,
                'notes' => $validated['notes'] ?? null,
            ]);

            // Handle cash movement & financial transactions
            if ($hasCashMovement && $account) {
                $contactLabel = $contact ? $contact->name : 'Contact';
                $notesDesc = ! empty($validated['notes']) ? ": {$validated['notes']}" : '';

                if ($direction === 'out') {
                    // Money leaves our account immediately
                    $fee = $account->calculateOutgoingFee($amount, isset($validated['fee']) ? (float) $validated['fee'] : null);
                    $totalDeduction = $amount + $fee;

                    if ((float) $account->current_balance < $totalDeduction) {
                        throw \Illuminate\Validation\ValidationException::withMessages([
                            'disburse_account_id' => ["Insufficient balance in account '{$account->name}'. Available: ".number_format((float) $account->current_balance, 2)." ETB, Required: ".number_format($totalDeduction, 2)." ETB (including fee)."],
                        ]);
                    }
                    $account->decrement('current_balance', $totalDeduction);

                    $txType = $type === 'payable' ? 'supplier_payment' : 'loan_disbursement';
                    $txDesc = $type === 'payable'
                        ? "Peer vendor payout to {$contactLabel}{$notesDesc}"
                        : "Cash lent/disbursed to {$contactLabel}{$notesDesc}";

                    FinancialTransaction::create([
                        'tenant_id' => $tenantId,
                        'transaction_number' => 'TXN-'.strtoupper(Str::random(8)),
                        'source_account_id' => $account->id,
                        'type' => $txType,
                        'amount' => $amount,
                        'fee' => $fee,
                        'contact_id' => $contactId,
                        'reference_number' => "DEBT-{$debt->id}",
                        'description' => $txDesc,
                        'date' => now(),
                        'created_by' => $user->id,
                    ]);

                    if ($isImmediateSettlement) {
                        DebtPayment::create([
                            'tenant_id' => $tenantId,
                            'debt_id' => $debt->id,
                            'financial_account_id' => $account->id,
                            'amount' => $amount,
                            'payment_date' => now(),
                            'reference_number' => 'PAYOUT-DIRECT',
                            'notes' => 'Settled via direct cash payout',
                            'created_by' => $user->id,
                        ]);
                    }
                } elseif ($direction === 'in') {
                    // Money enters our account immediately
                    $account->increment('current_balance', $amount);

                    $txType = $type === 'receivable' ? 'customer_payment' : 'borrowed_funds';
                    $txDesc = $type === 'receivable'
                        ? "Payment received from {$contactLabel}{$notesDesc}"
                        : "Borrowed cash received from {$contactLabel}{$notesDesc}";

                    FinancialTransaction::create([
                        'tenant_id' => $tenantId,
                        'transaction_number' => 'TXN-'.strtoupper(Str::random(8)),
                        'destination_account_id' => $account->id,
                        'type' => $txType,
                        'amount' => $amount,
                        'contact_id' => $contactId,
                        'reference_number' => "DEBT-{$debt->id}",
                        'description' => $txDesc,
                        'date' => now(),
                        'created_by' => $user->id,
                    ]);

                    if ($isImmediateSettlement) {
                        DebtPayment::create([
                            'tenant_id' => $tenantId,
                            'debt_id' => $debt->id,
                            'financial_account_id' => $account->id,
                            'amount' => $amount,
                            'payment_date' => now(),
                            'reference_number' => 'RECEIPT-DIRECT',
                            'notes' => 'Settled via direct cash receipt',
                            'created_by' => $user->id,
                        ]);
                    }
                }
            }

            // Mutual debt cancellation / offset:
            // If we record a receivable for someone we already owe, or a payable for someone who owes us,
            // automatically cancel out against existing open obligations so balances remain strictly synchronized.
            if (! $isImmediateSettlement) {
                if ($type === 'receivable') {
                    $openPayables = Debt::where('tenant_id', $tenantId)
                        ->where('contact_id', $contactId)
                        ->where('type', 'payable')
                        ->whereIn('status', ['open', 'partially_paid'])
                        ->orderBy('created_at')
                        ->get();

                    if ($openPayables->isNotEmpty()) {
                        $remainingToOffset = $amount;
                        foreach ($openPayables as $openPayable) {
                            if ($remainingToOffset <= 0) {
                                break;
                            }

                            $payAmount = min($remainingToOffset, (float) $openPayable->remaining_amount);
                            $newPayablePaid = (float) $openPayable->paid_amount + $payAmount;
                            $newPayableRemaining = max(0, (float) $openPayable->original_amount - $newPayablePaid);
                            $newPayableStatus = $newPayableRemaining <= 0 ? 'settled' : 'partially_paid';

                            DebtPayment::create([
                                'tenant_id' => $tenantId,
                                'debt_id' => $openPayable->id,
                                'financial_account_id' => $account?->id,
                                'amount' => $payAmount,
                                'payment_date' => now(),
                                'reference_number' => $hasCashMovement ? "PAYOUT-{$debt->id}" : "OFFSET-{$debt->id}",
                                'notes' => $hasCashMovement
                                    ? ($account ? "Direct transfer from {$account->name} to pay down debt" : 'Direct payout to pay down debt')
                                    : 'Mutual credit offset against debt obligation',
                                'created_by' => $user->id,
                            ]);

                            $openPayable->update([
                                'paid_amount' => $newPayablePaid,
                                'remaining_amount' => $newPayableRemaining,
                                'status' => $newPayableStatus,
                            ]);

                            $remainingToOffset -= $payAmount;
                        }

                        $totalOffsetApplied = $amount - $remainingToOffset;
                        $newDebtRemaining = max(0, $amount - $totalOffsetApplied);
                        $newDebtStatus = $newDebtRemaining <= 0 ? 'settled' : ($totalOffsetApplied > 0 ? 'partially_paid' : 'open');

                        $debt->update([
                            'paid_amount' => $totalOffsetApplied,
                            'remaining_amount' => $newDebtRemaining,
                            'status' => $newDebtStatus,
                            'notes' => $debt->notes
                                ? "{$debt->notes} | Offset {$totalOffsetApplied} ETB against open payable debt"
                                : "Offset {$totalOffsetApplied} ETB against open payable debt",
                        ]);

                        if ($totalOffsetApplied > 0) {
                            DebtPayment::create([
                                'tenant_id' => $tenantId,
                                'debt_id' => $debt->id,
                                'financial_account_id' => $account?->id,
                                'amount' => $totalOffsetApplied,
                                'payment_date' => now(),
                                'reference_number' => 'MUTUAL-OFFSET',
                                'notes' => "Applied {$totalOffsetApplied} ETB to pay down open payable debt",
                                'created_by' => $user->id,
                            ]);
                        }
                    }
                } elseif ($type === 'payable') {
                    // Apply any existing vendor advances first
                    Debt::applyOpenAdvancesToPayable($debt);

                    // Then apply against any other open receivables for this contact
                    $debt->refresh();
                    if ((float) $debt->remaining_amount > 0) {
                        $openReceivables = Debt::where('tenant_id', $tenantId)
                            ->where('contact_id', $contactId)
                            ->where('type', 'receivable')
                            ->whereIn('status', ['open', 'partially_paid'])
                            ->where('id', '!=', $debt->id)
                            ->where('reference_type', '!=', 'vendor_advance_payout')
                            ->orderBy('created_at')
                            ->get();

                        if ($openReceivables->isNotEmpty()) {
                            $remainingToOffset = (float) $debt->remaining_amount;
                            foreach ($openReceivables as $openReceivable) {
                                if ($remainingToOffset <= 0) {
                                    break;
                                }

                                $offsetAmount = min($remainingToOffset, (float) $openReceivable->remaining_amount);
                                $newReceivablePaid = (float) $openReceivable->paid_amount + $offsetAmount;
                                $newReceivableRemaining = max(0, (float) $openReceivable->original_amount - $newReceivablePaid);
                                $newReceivableStatus = $newReceivableRemaining <= 0 ? 'settled' : 'partially_paid';

                                DebtPayment::create([
                                    'tenant_id' => $tenantId,
                                    'debt_id' => $openReceivable->id,
                                    'financial_account_id' => $account?->id,
                                    'amount' => $offsetAmount,
                                    'payment_date' => now(),
                                    'reference_number' => "OFFSET-{$debt->id}",
                                    'notes' => 'Mutual credit offset against payable obligation',
                                    'created_by' => $user->id,
                                ]);

                                $openReceivable->update([
                                    'paid_amount' => $newReceivablePaid,
                                    'remaining_amount' => $newReceivableRemaining,
                                    'status' => $newReceivableStatus,
                                ]);

                                $remainingToOffset -= $offsetAmount;
                            }

                            $totalOffsetApplied = (float) $debt->remaining_amount - $remainingToOffset;
                            $newPayablePaid = (float) $debt->paid_amount + $totalOffsetApplied;
                            $newPayableRemaining = max(0, (float) $debt->original_amount - $newPayablePaid);
                            $newPayableStatus = $newPayableRemaining <= 0 ? 'settled' : ($newPayablePaid > 0 ? 'partially_paid' : 'open');

                            $debt->update([
                                'paid_amount' => $newPayablePaid,
                                'remaining_amount' => $newPayableRemaining,
                                'status' => $newPayableStatus,
                                'notes' => $debt->notes
                                    ? "{$debt->notes} | Offset {$totalOffsetApplied} ETB against open receivable obligations"
                                    : "Offset {$totalOffsetApplied} ETB against open receivable obligations",
                            ]);

                            if ($totalOffsetApplied > 0) {
                                DebtPayment::create([
                                    'tenant_id' => $tenantId,
                                    'debt_id' => $debt->id,
                                    'financial_account_id' => $account?->id,
                                    'amount' => $totalOffsetApplied,
                                    'payment_date' => now(),
                                    'reference_number' => 'MUTUAL-OFFSET',
                                    'notes' => "Offset applied against open receivable obligations",
                                    'created_by' => $user->id,
                                ]);
                            }
                        }
                    }
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
                    'status' => $debt->status,
                    'due_date' => $debt->due_date,
                    'with_disbursement' => $hasCashMovement,
                    'direction' => $hasCashMovement ? $direction : null,
                ]
            );

            return $debt;
        });

        return response()->json([
            'success' => true,
            'message' => $debt->type === 'receivable'
                ? "Receivable obligation for {$debt->original_amount} ETB recorded."
                : "Payable obligation for {$debt->original_amount} ETB recorded.",
            'data' => $debt->load(['contact.debts', 'payments.financialAccount']),
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
            'data' => $debt->fresh(['contact.debts', 'payments.financialAccount']),
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
