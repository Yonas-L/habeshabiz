<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use App\Scopes\TenantScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class AccountController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var \App\Models\User|null $user */
        $user = $request->user();
        $isOwner = $user ? $user->isOwner() : false;

        $accounts = FinancialAccount::orderBy('name')->get();

        if (! $isOwner) {
            // Staff only see bank/cash account names and IDs to select payment destination; balances are masked
            $sanitized = $accounts->where('is_custom_asset', false)->values()->map(function ($acc) {
                return [
                    'id' => $acc->id,
                    'name' => $acc->name,
                    'type' => $acc->type,
                    'account_number' => $acc->account_number,
                    'currency' => $acc->currency,
                    'logo' => $acc->logo,
                    'current_balance' => null, // Hidden from staff
                    'is_custom_asset' => false,
                    'is_active' => $acc->is_active,
                ];
            });

            return response()->json([
                'success' => true,
                'data' => [
                    'treasury_accounts' => $sanitized,
                    'asset_accounts' => [],
                    'total_treasury' => null,
                    'total_assets' => null,
                    'grand_total' => null,
                ],
            ]);
        }

        $bankAndCash = $accounts->where('is_custom_asset', false)->values();
        $customAssets = $accounts->where('is_custom_asset', true)->values();

        return response()->json([
            'success' => true,
            'data' => [
                'treasury_accounts' => $bankAndCash,
                'asset_accounts' => $customAssets,
                'total_treasury' => $bankAndCash->sum('current_balance'),
                'total_assets' => $customAssets->sum('current_balance'),
                'grand_total' => $accounts->sum('current_balance'),
            ],
        ]);
    }

    public function transfer(Request $request): JsonResponse
    {
        /** @var \App\Models\User|null $user */
        $user = $request->user();
        if (! $user || ! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Only business owners can transfer funds between accounts.',
            ], 403);
        }

        $validated = $request->validate([
            'source_account_id' => ['required', 'exists:financial_accounts,id'],
            'destination_account_id' => ['required', 'exists:financial_accounts,id', 'different:source_account_id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'fee' => ['nullable', 'numeric', 'min:0'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string'],
        ]);

        $result = DB::transaction(function () use ($validated) {
            $source = FinancialAccount::findOrFail($validated['source_account_id']);
            $destination = FinancialAccount::findOrFail($validated['destination_account_id']);
            $amount = (float) $validated['amount'];
            $fee = (float) ($validated['fee'] ?? 0);
            $totalDeduction = $amount + $fee;

            if ((float) $source->current_balance < $totalDeduction) {
                throw new InvalidArgumentException("Insufficient balance in {$source->name}. Available: {$source->current_balance}, Required: {$totalDeduction}");
            }

            $source->decrement('current_balance', $totalDeduction);
            $destination->increment('current_balance', $amount);

            $txn = FinancialTransaction::create([
                'tenant_id' => TenantScope::getActiveTenantId(),
                'transaction_number' => 'TRF-'.strtoupper(Str::random(8)),
                'source_account_id' => $source->id,
                'destination_account_id' => $destination->id,
                'type' => 'transfer',
                'amount' => $amount,
                'fee' => $fee,
                'reference_number' => $validated['reference_number'] ?? null,
                'description' => $validated['description'] ?? "Transfer from {$source->name} to {$destination->name}",
                'date' => now(),
                'created_by' => auth()->id(),
            ]);

            return [
                'transaction' => $txn,
                'source_balance' => $source->fresh()->current_balance,
                'destination_balance' => $destination->fresh()->current_balance,
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'Funds transferred successfully.',
            'data' => $result,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Creating accounts is restricted to store owners.',
            ], 403);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', 'in:bank,mobile_money,cash,asset_gold,asset_fx,custom'],
            'account_number' => ['nullable', 'string', 'max:100'],
            'currency' => ['nullable', 'string', 'max:10'],
            'logo' => ['nullable', 'string'],
            'opening_balance' => ['nullable', 'numeric', 'min:0'],
            'is_custom_asset' => ['nullable', 'boolean'],
            'asset_details' => ['nullable', 'array'],
        ]);

        $type = $validated['type'];
        $isCustomAsset = $validated['is_custom_asset'] ?? in_array($type, ['asset_gold', 'asset_fx', 'custom']);

        $account = FinancialAccount::create([
            'tenant_id' => TenantScope::getActiveTenantId() ?? $user->tenant_id,
            'name' => $validated['name'],
            'type' => $type,
            'account_number' => $validated['account_number'] ?? null,
            'currency' => $validated['currency'] ?? 'ETB',
            'logo' => $validated['logo'] ?? null,
            'current_balance' => $validated['opening_balance'] ?? 0,
            'is_custom_asset' => $isCustomAsset,
            'asset_details' => $validated['asset_details'] ?? null,
            'is_active' => true,
        ]);

        \App\Models\AuditLog::record(
            action: 'account_created',
            entityType: 'FinancialAccount',
            entityId: $account->id,
            newValues: [
                'name' => $account->name,
                'type' => $account->type,
                'currency' => $account->currency,
                'opening_balance' => $account->current_balance,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => "Account {$account->name} created successfully.",
            'data' => $account,
        ], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Updating accounts is restricted to store owners.',
            ], 403);
        }

        $account = FinancialAccount::findOrFail($id);

        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'type' => ['nullable', 'in:bank,mobile_money,cash,asset_gold,asset_fx,custom'],
            'account_number' => ['nullable', 'string', 'max:100'],
            'currency' => ['nullable', 'string', 'max:10'],
            'logo' => ['nullable', 'string'],
            'is_custom_asset' => ['nullable', 'boolean'],
            'asset_details' => ['nullable', 'array'],
            'is_active' => ['nullable', 'boolean'],
            'balance_adjustment' => ['nullable', 'numeric'],
        ]);

        $oldValues = $account->only(['name', 'type', 'account_number', 'currency', 'logo', 'is_custom_asset', 'asset_details', 'is_active', 'current_balance']);

        if (array_key_exists('name', $validated)) $account->name = $validated['name'];
        if (array_key_exists('type', $validated)) $account->type = $validated['type'];
        if (array_key_exists('account_number', $validated)) $account->account_number = $validated['account_number'];
        if (array_key_exists('currency', $validated)) $account->currency = $validated['currency'];
        if (array_key_exists('logo', $validated)) $account->logo = $validated['logo'];
        if (array_key_exists('is_custom_asset', $validated)) $account->is_custom_asset = $validated['is_custom_asset'];
        if (array_key_exists('asset_details', $validated)) $account->asset_details = $validated['asset_details'];
        if (array_key_exists('is_active', $validated)) $account->is_active = $validated['is_active'];
        
        if (isset($validated['balance_adjustment'])) {
            $account->current_balance += (float) $validated['balance_adjustment'];
        }

        $account->save();

        \App\Models\AuditLog::record(
            action: 'account_updated',
            entityType: 'FinancialAccount',
            entityId: $account->id,
            oldValues: $oldValues,
            newValues: $account->only(['name', 'type', 'account_number', 'currency', 'logo', 'is_custom_asset', 'asset_details', 'is_active', 'current_balance'])
        );

        return response()->json([
            'success' => true,
            'message' => 'Account updated successfully.',
            'data' => $account->fresh(),
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if (! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Deleting accounts is restricted to store owners.',
            ], 403);
        }

        $account = FinancialAccount::findOrFail($id);
        $accountName = $account->name;
        $balance = (float) $account->current_balance;

        // Deactivate and soft-delete so all dependable historical transactions,
        // sales orders, expenses, and debt payments remain intact without constraint errors.
        $account->is_active = false;
        $account->save();
        $account->delete();

        \App\Models\AuditLog::record(
            action: 'account_deleted',
            entityType: 'FinancialAccount',
            entityId: $id,
            oldValues: [
                'name' => $accountName,
                'current_balance' => $balance,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => "Account {$accountName} removed successfully.",
        ]);
    }

    /**
     * Get dedicated transaction ledger and activity dashboard for a specific financial account.
     */
    public function activities(Request $request, string $id): JsonResponse
    {
        /** @var \App\Models\User|null $user */
        $user = $request->user();
        if (! $user || ! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only business owners can view full account ledgers.',
            ], 403);
        }

        $account = FinancialAccount::withTrashed()->findOrFail($id);

        // Fetch all transactions involving this account in ascending order to calculate running balance
        $allTxns = FinancialTransaction::with(['contact', 'sourceAccount', 'destinationAccount', 'creator'])
            ->where(function ($q) use ($account) {
                $q->where('source_account_id', $account->id)
                  ->orWhere('destination_account_id', $account->id);
            })
            ->orderBy('date', 'asc')
            ->orderBy('created_at', 'asc')
            ->get();

        // Calculate running balance working backwards from live current balance
        $currentBalance = (float) $account->current_balance;
        $runningBalance = $currentBalance;

        $processedDescending = [];
        $reversed = $allTxns->reverse();

        foreach ($reversed as $txn) {
            $isDestination = $txn->destination_account_id === $account->id;
            $amount = (float) $txn->amount;
            $fee = (float) ($txn->fee ?? 0);

            if ($isDestination) {
                // Inflow into this account
                $direction = 'inflow';
                $inflow = $amount;
                $outflow = 0.0;
                $netEffect = $amount;
            } else {
                // Outflow from this account
                $direction = 'outflow';
                $inflow = 0.0;
                $outflow = $amount + $fee;
                $netEffect = - ($amount + $fee);
            }

            $stampedBalance = $runningBalance;
            $runningBalance -= $netEffect; // balance before this transaction

            // Determine friendly type label
            $typeLabel = match ($txn->type) {
                'customer_payment' => 'Customer Sale / Collection',
                'supplier_payment' => 'Vendor / Supplier Payout',
                'expense' => 'Operating Expense',
                'owner_draw' => 'Owner Draw',
                'transfer' => $isDestination ? 'Transfer In' : 'Transfer Out',
                'income' => 'Direct Income',
                'loan_disbursement' => 'Loan Disbursement',
                'borrowed_funds' => 'Capital Deposit',
                default => ucfirst(str_replace('_', ' ', $txn->type)),
            };

            $counterparty = null;
            if ($txn->contact) {
                $counterparty = $txn->contact->name;
            } elseif ($txn->type === 'transfer') {
                $counterparty = $isDestination
                    ? ($txn->sourceAccount?->name ?? 'Other Account')
                    : ($txn->destinationAccount?->name ?? 'Other Account');
            } elseif ($txn->type === 'owner_draw') {
                $counterparty = $txn->creator?->name ?? 'Owner';
            }

            $processedDescending[] = [
                'id' => (string) $txn->id,
                'transaction_number' => $txn->transaction_number,
                'date' => $txn->date->toIso8601String(),
                'type' => $txn->type,
                'type_label' => $typeLabel,
                'direction' => $direction,
                'amount' => $amount,
                'fee' => $fee,
                'inflow' => $inflow,
                'outflow' => $outflow,
                'net_effect' => $netEffect,
                'balance_after' => round($stampedBalance, 2),
                'reference_number' => $txn->reference_number,
                'contact_id' => $txn->contact_id,
                'counterparty' => $counterparty,
                'description' => $txn->description,
                'created_by' => $txn->creator?->name,
            ];
        }

        $allEntries = collect($processedDescending);

        // Overall summary metrics across all time
        $totalInflow = $allEntries->sum('inflow');
        $totalOutflow = $allEntries->sum('outflow');
        $netFlow = $totalInflow - $totalOutflow;

        // Apply filters
        $filtered = $allEntries;

        // Type filter
        if ($request->filled('type') && $request->type !== 'all') {
            $t = $request->type;
            if ($t === 'inflow') {
                $filtered = $filtered->where('direction', 'inflow');
            } elseif ($t === 'outflow') {
                $filtered = $filtered->where('direction', 'outflow');
            } elseif ($t === 'transfer') {
                $filtered = $filtered->where('type', 'transfer');
            } elseif ($t === 'sale' || $t === 'customer_payment') {
                $filtered = $filtered->where('type', 'customer_payment');
            } elseif ($t === 'supplier_payment') {
                $filtered = $filtered->where('type', 'supplier_payment');
            } elseif ($t === 'expense') {
                $filtered = $filtered->whereIn('type', ['expense', 'owner_draw']);
            }
        }

        // Date range filter
        if ($request->filled('start_date')) {
            $start = \Carbon\Carbon::parse($request->start_date)->startOfDay();
            $filtered = $filtered->filter(fn ($item) => \Carbon\Carbon::parse($item['date'])->greaterThanOrEqualTo($start));
        }
        if ($request->filled('end_date')) {
            $end = \Carbon\Carbon::parse($request->end_date)->endOfDay();
            $filtered = $filtered->filter(fn ($item) => \Carbon\Carbon::parse($item['date'])->lessThanOrEqualTo($end));
        }

        // Search filter
        if ($request->filled('search')) {
            $s = mb_strtolower(trim($request->search));
            $filtered = $filtered->filter(function ($item) use ($s) {
                return str_contains(mb_strtolower($item['transaction_number'] ?? ''), $s)
                    || str_contains(mb_strtolower($item['reference_number'] ?? ''), $s)
                    || str_contains(mb_strtolower($item['counterparty'] ?? ''), $s)
                    || str_contains(mb_strtolower($item['description'] ?? ''), $s)
                    || str_contains(mb_strtolower($item['type_label'] ?? ''), $s);
            });
        }

        $items = $filtered->values();

        return response()->json([
            'success' => true,
            'data' => [
                'account' => $account,
                'summary' => [
                    'current_balance' => $currentBalance,
                    'total_inflow' => round($totalInflow, 2),
                    'total_outflow' => round($totalOutflow, 2),
                    'net_flow' => round($netFlow, 2),
                    'filtered_inflow' => round($items->sum('inflow'), 2),
                    'filtered_outflow' => round($items->sum('outflow'), 2),
                    'filtered_net' => round($items->sum('inflow') - $items->sum('outflow'), 2),
                    'total_count' => $allEntries->count(),
                    'filtered_count' => $items->count(),
                ],
                'activities' => $items,
            ],
        ]);
    }
}
