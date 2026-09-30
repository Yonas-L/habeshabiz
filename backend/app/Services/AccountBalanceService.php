<?php

namespace App\Services;

use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class AccountBalanceService
{
    /**
     * Calculate historical balances for given accounts as of a timestamp.
     *
     * @param  Collection<int, FinancialAccount>  $accounts
     * @return Collection<int, FinancialAccount>
     */
    public function calculateBalancesAsOf(Collection $accounts, ?Carbon $asOfDate): Collection
    {
        if (! $asOfDate || $asOfDate->isFuture()) {
            return $accounts;
        }

        $accountIds = $accounts->pluck('id')->filter()->all();
        if (empty($accountIds)) {
            return $accounts;
        }

        $inflowsAfter = FinancialTransaction::whereIn('destination_account_id', $accountIds)
            ->where('date', '>', $asOfDate)
            ->groupBy('destination_account_id')
            ->selectRaw('destination_account_id, SUM(amount) as total')
            ->pluck('total', 'destination_account_id');

        $outflowsAfter = FinancialTransaction::whereIn('source_account_id', $accountIds)
            ->where('date', '>', $asOfDate)
            ->groupBy('source_account_id')
            ->selectRaw('source_account_id, SUM(amount + COALESCE(fee, 0)) as total')
            ->pluck('total', 'source_account_id');

        foreach ($accounts as $acc) {
            $inflow = (float) ($inflowsAfter[$acc->id] ?? 0);
            $outflow = (float) ($outflowsAfter[$acc->id] ?? 0);
            $historical = round((float) $acc->current_balance - $inflow + $outflow, 2);
            $acc->current_balance = (string) $historical;
        }

        return $accounts;
    }
}
