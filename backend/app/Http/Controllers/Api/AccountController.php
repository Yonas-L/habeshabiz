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
        $accounts = FinancialAccount::orderBy('name')->get();

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
