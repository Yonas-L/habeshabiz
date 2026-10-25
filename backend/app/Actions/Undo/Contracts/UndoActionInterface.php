<?php

namespace App\Actions\Undo\Contracts;

use App\Exceptions\UndoBlockedException;
use App\Models\AuditLog;

interface UndoActionInterface
{
    /**
     * Inspect dependencies and generate an impact preview with linked hierarchy nodes.
     * Must be read-only and NOT mutate any data.
     *
     * @return array<string, mixed>
     */
    public function preview(AuditLog $log): array;

    /**
     * Atomically execute the reversal using compensating deltas.
     *
     * @return string Human-friendly confirmation message
     *
     * @throws UndoBlockedException
     */
    public function execute(AuditLog $log): string;
}
