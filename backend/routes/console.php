<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('inventory:sync-stock', function (\App\Actions\SynchronizeInventoryStockAction $action) {
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

    $this->info(count($changes) . ' variant(s) synchronized successfully.');
})->purpose('Synchronize stock quantity counters with actual physical in-stock inventory units');

