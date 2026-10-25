<?php

namespace App\Actions\Undo;

use App\Actions\Undo\Contracts\UndoActionInterface;
use InvalidArgumentException;

class UndoActionFactory
{
    /**
     * Map of undoable audit actions to their dedicated resolver classes.
     *
     * @var array<string, class-string<UndoActionInterface>>
     */
    protected static array $actionMap = [
        'sale_created' => UndoSaleAction::class,
        'sales_order_balance_collected' => UndoPaymentCollectionAction::class,
        'stock_intake' => UndoStockIntakeAction::class,
        'unit_handover' => UndoHandoverAction::class,
        'unit_instant_offset' => UndoHandoverSoldAction::class,
        'unit_handover_sold' => UndoHandoverSoldAction::class,
        'handover_marked_sold' => UndoHandoverSoldAction::class,
        'expense_created' => UndoExpenseAction::class,
        'account_transfer' => UndoAccountTransferAction::class,
        'proforma_invoice_created' => UndoProformaInvoiceAction::class,
    ];

    /**
     * Determine whether the given audit action can be undone.
     */
    public static function isUndoable(?string $action): bool
    {
        if (! $action) {
            return false;
        }

        return array_key_exists($action, static::$actionMap);
    }

    /**
     * Resolve the action instance for the given audit log action.
     *
     * @throws InvalidArgumentException
     */
    public static function make(string $action): UndoActionInterface
    {
        if (! static::isUndoable($action)) {
            throw new InvalidArgumentException("Action '{$action}' does not support automatic undo.");
        }

        $class = static::$actionMap[$action];

        return app($class);
    }
}
