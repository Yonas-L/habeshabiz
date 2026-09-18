<?php

namespace App\Http\Controllers\Api;

use App\Actions\SettleDebtPaymentAction;
use App\Http\Controllers\Controller;
use App\Models\Debt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
            $query->whereHas('contact', fn ($q) => $q->where('name', 'ilike', "%{$search}%"));
        }

        $debts = $query->orderByDesc('remaining_amount')->get();

        return response()->json([
            'success' => true,
            'data' => $debts,
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
