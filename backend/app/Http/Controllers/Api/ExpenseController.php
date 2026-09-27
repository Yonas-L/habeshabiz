<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Contact;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\Expense;
use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use App\Models\InventoryUnit;
use App\Models\MaintenanceRecord;
use App\Scopes\TenantScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ExpenseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Expense::with(['financialAccount', 'inventoryUnit.variant.product']);

        if ($request->has('is_owner_draw')) {
            $query->where('is_owner_draw', filter_var($request->is_owner_draw, FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        $expenses = $query->latest('date')->paginate(30);

        return response()->json([
            'success' => true,
            'data' => $expenses->items(),
            'pagination' => [
                'current_page' => $expenses->currentPage(),
                'last_page' => $expenses->lastPage(),
                'total' => $expenses->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'financial_account_id' => ['required', 'exists:financial_accounts,id'],
            'inventory_unit_id' => ['nullable', 'exists:inventory_units,id'],
            'category' => ['required', 'string', 'in:ride,food,rent,utilities,maintenance,salary,personal_owner_draw,vendor_payout,other'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'is_owner_draw' => ['boolean'],
            'vendor_billing' => ['nullable', 'string', 'in:shop,vendor_deduct,vendor_reimburse'],
            'vendor_contact_id' => ['nullable', 'exists:contacts,id'],
            'description' => ['required', 'string', 'max:255'],
            'date' => ['nullable', 'date'],
        ]);

        $expense = DB::transaction(function () use ($validated) {
            $tenantId = TenantScope::getActiveTenantId();
            $account = FinancialAccount::findOrFail($validated['financial_account_id']);
            $amount = (float) $validated['amount'];

            // Deduct from financial account (paying technician/service/vendor)
            $account->decrement('current_balance', $amount);

            $vendorBilling = $validated['vendor_billing'] ?? 'shop';
            $vendorContactId = $validated['vendor_contact_id'] ?? null;
            $vendorDebtId = null;

            $expense = Expense::create([
                'tenant_id' => $tenantId,
                'financial_account_id' => $account->id,
                'inventory_unit_id' => $validated['inventory_unit_id'] ?? null,
                'vendor_billing' => $vendorBilling,
                'vendor_contact_id' => $vendorContactId,
                'category' => $validated['category'],
                'amount' => $amount,
                'is_owner_draw' => $validated['is_owner_draw'] ?? ($validated['category'] === 'personal_owner_draw'),
                'description' => $validated['description'],
                'date' => $validated['date'] ?? now(),
                'created_by' => auth()->id(),
            ]);

            // Handle direct vendor wire transfer / cash payout
            if ($vendorContactId && empty($validated['inventory_unit_id'])) {
                $openPayables = Debt::where('tenant_id', $tenantId)
                    ->where('contact_id', $vendorContactId)
                    ->where('type', 'payable')
                    ->whereIn('status', ['open', 'partially_paid'])
                    ->orderBy('created_at')
                    ->get();

                $remainingToSettle = $amount;
                foreach ($openPayables as $openPayable) {
                    if ($remainingToSettle <= 0) {
                        break;
                    }

                    $payAmount = min($remainingToSettle, (float) $openPayable->remaining_amount);
                    $newPaid = (float) $openPayable->paid_amount + $payAmount;
                    $newRemaining = max(0, (float) $openPayable->original_amount - $newPaid);
                    $newStatus = $newRemaining <= 0 ? 'settled' : 'partially_paid';

                    DebtPayment::create([
                        'tenant_id' => $tenantId,
                        'debt_id' => $openPayable->id,
                        'financial_account_id' => $account->id,
                        'amount' => $payAmount,
                        'payment_date' => $expense->date ?? now(),
                        'reference_number' => "EXP-{$expense->id}",
                        'notes' => "Payout via Expense: {$validated['description']}",
                        'created_by' => auth()->id(),
                    ]);

                    $openPayable->update([
                        'paid_amount' => $newPaid,
                        'remaining_amount' => $newRemaining,
                        'status' => $newStatus,
                    ]);

                    $remainingToSettle -= $payAmount;
                }

                // If payout exceeds open payables, record the excess as a receivable advance
                if ($remainingToSettle > 0) {
                    Debt::create([
                        'tenant_id' => $tenantId,
                        'contact_id' => $vendorContactId,
                        'type' => 'receivable',
                        'reference_type' => 'vendor_advance_payout',
                        'reference_id' => (string) $expense->id,
                        'original_amount' => $remainingToSettle,
                        'paid_amount' => 0.0,
                        'remaining_amount' => $remainingToSettle,
                        'due_date' => now()->addDays(30),
                        'status' => 'open',
                        'notes' => "Vendor wire advance via Expense: {$validated['description']}",
                    ]);
                }
            }

            // If linked to a device for maintenance, also log a maintenance record for asset lifecycle
            if (! empty($validated['inventory_unit_id'])) {
                $unit = InventoryUnit::find($validated['inventory_unit_id']);
                if ($unit) {
                    if (! $vendorContactId) {
                        $vendorContactId = $unit->supplier_contact_id;
                    }

                    // 1) If vendor deductible billing is chosen and we have a vendor contact
                    if ($vendorBilling === 'vendor_deduct' && $vendorContactId) {
                        // Find any open payable debt for this vendor
                        $openPayable = Debt::where('tenant_id', $tenantId)
                            ->where('contact_id', $vendorContactId)
                            ->where('type', 'payable')
                            ->whereIn('status', ['open', 'partially_paid'])
                            ->orderBy('created_at')
                            ->first();

                        if ($openPayable) {
                            $newPaid = (float) $openPayable->paid_amount + $amount;
                            $newRemaining = max(0, (float) $openPayable->original_amount - $newPaid);
                            $newStatus = $newRemaining <= 0 ? 'settled' : 'partially_paid';

                            // Record DebtPayment so subsequent debt settlements respect this offset!
                            DebtPayment::create([
                                'tenant_id' => $tenantId,
                                'debt_id' => $openPayable->id,
                                'financial_account_id' => $account->id,
                                'amount' => $amount,
                                'payment_date' => $expense->date ?? now(),
                                'reference_number' => 'REPAIR-OFFSET',
                                'notes' => "Repair offset deduction for SN: ".($unit->imei_or_serial ?? 'Unit'),
                                'created_by' => auth()->id(),
                            ]);

                            $openPayable->update([
                                'paid_amount' => $newPaid,
                                'remaining_amount' => $newRemaining,
                                'status' => $newStatus,
                                'notes' => $openPayable->notes
                                    ? "{$openPayable->notes} | Deducted {$amount} ETB repair cost for SN: ".($unit->imei_or_serial ?? 'Unit')
                                    : "Deducted {$amount} ETB repair cost for SN: ".($unit->imei_or_serial ?? 'Unit'),
                            ]);
                            $vendorDebtId = $openPayable->id;
                        } else {
                            // If no open payable exists to deduct from, automatically create a receivable
                            $vendorReceivable = Debt::create([
                                'tenant_id' => $tenantId,
                                'contact_id' => $vendorContactId,
                                'type' => 'receivable',
                                'reference_type' => 'vendor_repair_reimbursement',
                                'reference_id' => $unit->id,
                                'original_amount' => $amount,
                                'paid_amount' => 0.0,
                                'remaining_amount' => $amount,
                                'due_date' => now()->addDays(7),
                                'status' => 'open',
                                'notes' => "Repair reimbursement claim for defective device SN: ".($unit->imei_or_serial ?? 'Unit'),
                            ]);
                            $vendorDebtId = $vendorReceivable->id;
                        }
                    } elseif ($vendorBilling === 'vendor_reimburse' && $vendorContactId) {
                        // 2) Explicit vendor reimbursement requested
                        $vendorReceivable = Debt::create([
                            'tenant_id' => $tenantId,
                            'contact_id' => $vendorContactId,
                            'type' => 'receivable',
                            'reference_type' => 'vendor_repair_reimbursement',
                            'reference_id' => $unit->id,
                            'original_amount' => $amount,
                            'paid_amount' => 0.0,
                            'remaining_amount' => $amount,
                            'due_date' => now()->addDays(7),
                            'status' => 'open',
                            'notes' => "Repair reimbursement claim for defective device SN: ".($unit->imei_or_serial ?? 'Unit'),
                        ]);
                        $vendorDebtId = $vendorReceivable->id;
                    }

                    $unitUpdates = ['is_repaired' => true];
                    if (in_array($unit->status, ['returned', 'damaged'])) {
                        $unitUpdates['status'] = 'fixed';
                        $unitUpdates['location'] = 'Repair Shelf (Fixed)';
                    }
                    $unit->update($unitUpdates);

                    AuditLog::record(
                        action: 'unit_marked_fixed',
                        entityType: 'InventoryUnit',
                        entityId: (string) $unit->id,
                        newValues: [
                            'imei_or_serial' => $unit->imei_or_serial,
                            'status' => 'fixed',
                            'repair_expense_id' => $expense->id,
                            'repair_cost' => $amount,
                            'vendor_billing' => $vendorBilling,
                        ]
                    );
                }

                // If vendor covered (deducted or reimbursed), is_capitalized is set to true so restock won't increase unit cost basis!
                $isCapitalized = in_array($vendorBilling, ['vendor_deduct', 'vendor_reimburse']);

                MaintenanceRecord::create([
                    'tenant_id' => $tenantId,
                    'inventory_unit_id' => $validated['inventory_unit_id'],
                    'cost' => $amount,
                    'is_capitalized' => $isCapitalized,
                    'billing_type' => $vendorBilling,
                    'vendor_contact_id' => $vendorContactId,
                    'vendor_debt_id' => $vendorDebtId,
                    'financial_account_id' => $account->id,
                    'description' => $validated['description'],
                    'date' => $expense->date,
                ]);
            }

            FinancialTransaction::create([
                'tenant_id' => $tenantId,
                'transaction_number' => 'EXP-'.strtoupper(Str::random(8)),
                'source_account_id' => $account->id,
                'type' => ($validated['is_owner_draw'] ?? false) ? 'owner_draw' : 'expense',
                'amount' => $amount,
                'description' => $validated['description'],
                'date' => $expense->date,
                'created_by' => auth()->id(),
            ]);

            return $expense->load(['financialAccount', 'inventoryUnit.variant.product', 'vendorContact']);
        });

        return response()->json([
            'success' => true,
            'message' => 'Expense recorded and account deducted.',
            'data' => $expense,
        ], 201);
    }
}
