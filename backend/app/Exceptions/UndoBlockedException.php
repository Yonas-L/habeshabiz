<?php

namespace App\Exceptions;

use RuntimeException;

class UndoBlockedException extends RuntimeException
{
    /**
     * @param  array<int, string>  $blockedBy  Plain-English explanations for why the action cannot be undone
     */
    public function __construct(
        string $message,
        public readonly array $blockedBy = []
    ) {
        parent::__construct($message);
    }

    /**
     * @return array<int, string>
     */
    public function getBlockedReasons(): array
    {
        return $this->blockedBy;
    }
}
