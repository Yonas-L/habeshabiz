<?php

namespace App\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

class TenantScope implements Scope
{
    protected static ?string $forcedTenantId = null;

    public static function setForcedTenantId(?string $tenantId): void
    {
        static::$forcedTenantId = $tenantId;
    }

    public static function getActiveTenantId(): ?string
    {
        if (static::$forcedTenantId !== null) {
            return static::$forcedTenantId;
        }

        if (auth()->check() && auth()->user()->tenant_id) {
            return auth()->user()->tenant_id;
        }

        return null;
    }

    public function apply(Builder $builder, Model $model): void
    {
        $tenantId = static::getActiveTenantId();

        if ($tenantId !== null) {
            $builder->where($model->getTable().'.tenant_id', $tenantId);
        }
    }
}
