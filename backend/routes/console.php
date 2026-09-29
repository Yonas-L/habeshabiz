<?php

use App\Actions\SynchronizeInventoryStockAction;
use App\Models\PlatformSignupAttempt;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('inventory:sync-stock', function (SynchronizeInventoryStockAction $action) {
    $this->info('Synchronizing inventory stock counters with actual physical units...');
    $changes = $action->execute();

    if (empty($changes)) {
        $this->info('All inventory stock records are already in perfect sync.');

        return;
    }

    $this->table(
        ['Product', 'SKU', 'Action', 'Details'],
        array_map(function ($c) {
            $details = isset($c['new_qty'])
                ? "{$c['old_qty']} -> {$c['new_qty']}"
                : "Qty on hand: {$c['quantity_on_hand']}";

            return [$c['product'], $c['sku'] ?? 'N/A', $c['action'], $details];
        }, $changes)
    );

    $this->info(count($changes).' variant(s) synchronized successfully.');
})->purpose('Synchronize stock quantity counters with actual physical in-stock inventory units');

Artisan::command('platform:cleanup-signup-attempts', function () {
    $cutoff = now()->subDays(90);
    $deleted = PlatformSignupAttempt::where('created_at', '<', $cutoff)->delete();
    $this->info("Deleted {$deleted} signup attempts older than 90 days.");
})->purpose('Delete platform signup attempts older than 90 days');

Schedule::command('platform:cleanup-signup-attempts')->daily();
