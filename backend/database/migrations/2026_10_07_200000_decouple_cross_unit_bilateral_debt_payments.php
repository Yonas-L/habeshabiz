<?php

use App\Models\Debt;
use App\Models\DebtPayment;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::transaction(function () {
            $iphoneDebtId = '01a11741-a0b6-7379-8745-abda33d68576';
            $samsungUnitId = '01a11742-291f-722a-a68f-8aa543409eac';

            $natiDebt = Debt::with('payments')->find($iphoneDebtId);
            if (! $natiDebt) {
                return;
            }

            // Identify any Samsung A36 payments erroneously attached to Nati's iPhone 15 debt
            $samsungPayments = $natiDebt->payments->filter(function ($p) use ($samsungUnitId) {
                return str_contains($p->notes ?? '', $samsungUnitId)
                    || str_contains($p->notes ?? '', 'Samsung Galaxy A36');
            });

            if ($samsungPayments->isNotEmpty()) {
                // Create dedicated bilateral handover holding debt for Samsung A36
                $handoverDebt = Debt::firstOrCreate(
                    [
                        'tenant_id' => $natiDebt->tenant_id,
                        'contact_id' => $natiDebt->contact_id,
                        'reference_type' => 'handover_holding',
                        'reference_id' => $samsungUnitId,
                    ],
                    [
                        'type' => 'payable',
                        'original_amount' => 0.0,
                        'paid_amount' => 0.0,
                        'remaining_amount' => 0.0,
                        'status' => 'settled',
                        'notes' => 'Bilateral handover movements for Samsung Galaxy A36 (SN: 84723984398427)',
                    ]
                );

                // Move the Samsung payments to the dedicated debt
                foreach ($samsungPayments as $p) {
                    $p->update(['debt_id' => $handoverDebt->id]);
                }
                $handoverDebt->recalculateSettlement();
            }

            // Clean up the iPhone 15 payments so they reflect purely the iPhone 15 unit lifecycle (100,000 ETB)
            $pReturn1 = DebtPayment::find('01a1178e-8f01-704a-8d4c-67320a64bd3e');
            $pRecFixed = DebtPayment::find('01a1179d-d1bc-720a-ba0a-6882ee15d4b7');
            $pReturn2 = DebtPayment::find('01a1179e-62ea-72e6-9151-794a812cfb17');
            $pAdj = DebtPayment::find('01a117c6-2de9-73bf-9b75-f60f8ac0fbd9');

            if ($pReturn1 && (float) $pReturn1->amount === 50000.0) {
                $pReturn1->update(['amount' => 100000.0]);
            }
            if ($pRecFixed && (float) $pRecFixed->amount === -50000.0) {
                $pRecFixed->update(['amount' => -100000.0]);
            }
            if ($pReturn2 && (float) $pReturn2->amount === 50000.0) {
                $pReturn2->update(['amount' => 100000.0]);
            }
            if ($pAdj) {
                $pAdj->delete();
            }

            $natiDebt->recalculateSettlement();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // One-way data sanitization migration
    }
};
