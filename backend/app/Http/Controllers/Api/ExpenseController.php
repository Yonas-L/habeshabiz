<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use App\Scopes\TenantScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ExpenseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Expense::with('financialAccount');

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
            'category' => ['required', 'string', 'in:ride,food,rent,utilities,maintenance,personal_owner_draw,other'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'is_owner_draw' => ['boolean'],
            'description' => ['required', 'string', 'max:255'],
            'date' => ['nullable', 'date'],
        ]);

        $expense = DB::transaction(function () use ($validated) {
            $tenantId = TenantScope::getActiveTenantId();
            $account = FinancialAccount::findOrFail($validated['financial_account_id']);
            $amount = (float) $validated['amount'];

            // Deduct from financial account
            $account->decrement('current_balance', $amount);

            $expense = Expense::create([
                'tenant_id' => $tenantId,
                'financial_account_id' => $account->id,
                'category' => $validated['category'],
                'amount' => $amount,
                'is_owner_draw' => $validated['is_owner_draw'] ?? ($validated['category'] === 'personal_owner_draw'),
                'description' => $validated['description'],
                'date' => $validated['date'] ?? now(),
                'created_by' => auth()->id(),
            ]);

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

            return $expense->load('financialAccount');
        });

        return response()->json([
            'success' => true,
            'message' => 'Expense recorded and account deducted.',
            'data' => $expense,
        ], 201);
    }
}
