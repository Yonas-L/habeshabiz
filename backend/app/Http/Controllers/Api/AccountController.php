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
}
