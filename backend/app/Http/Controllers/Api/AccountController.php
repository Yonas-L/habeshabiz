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
            'is_custom_asset' => ['nullable', 'boolean'],
            'asset_details' => ['nullable', 'array'],
            'is_active' => ['nullable', 'boolean'],
            'balance_adjustment' => ['nullable', 'numeric'],
        ]);

        $oldValues = $account->only(['name', 'type', 'account_number', 'currency', 'is_custom_asset', 'asset_details', 'is_active', 'current_balance']);

        if (array_key_exists('name', $validated)) $account->name = $validated['name'];
        if (array_key_exists('type', $validated)) $account->type = $validated['type'];
        if (array_key_exists('account_number', $validated)) $account->account_number = $validated['account_number'];
        if (array_key_exists('currency', $validated)) $account->currency = $validated['currency'];
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
            newValues: $account->only(['name', 'type', 'account_number', 'currency', 'is_custom_asset', 'asset_details', 'is_active', 'current_balance'])
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

        $account = FinancialAccount::withCount(['sourceTransactions', 'destinationTransactions', 'expenses', 'debtPayments'])->findOrFail($id);

        $hasReferences = $account->source_transactions_count > 0 
            || $account->destination_transactions_count > 0
            || $account->expenses_count > 0
            || $account->debt_payments_count > 0;

        if ($hasReferences) {
            if ($account->is_active) {
                $account->is_active = false;
                $account->save();
                
                \App\Models\AuditLog::record(
                    action: 'account_deactivated',
                    entityType: 'FinancialAccount',
                    entityId: $account->id,
                    newValues: ['is_active' => false]
                );
            }

            return response()->json([
                'success' => false,
                'message' => 'Account cannot be deleted because it has associated transactions, expenses, or debt payments. It has been deactivated instead.',
            ], 422);
        }

        $account->delete();

        \App\Models\AuditLog::record(
            action: 'account_deleted',
            entityType: 'FinancialAccount',
            entityId: $id,
            oldValues: ['name' => $account->name]
        );

        return response()->json([
            'success' => true,
            'message' => 'Account deleted successfully.',
        ]);
    }
}
