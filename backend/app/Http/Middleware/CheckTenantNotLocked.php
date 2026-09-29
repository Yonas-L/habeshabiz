<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class CheckTenantNotLocked
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->tenant_id) {
            $lockData = Cache::remember("tenant_locked:{$user->tenant_id}", 60, function () use ($user): ?array {
                $tenant = Tenant::find($user->tenant_id);

                return $tenant ? [
                    'is_locked' => (bool) $tenant->is_locked,
                    'lock_reason' => $tenant->lock_reason,
                ] : null;
            });

            if ($lockData && $lockData['is_locked']) {
                return response()->json([
                    'error' => 'tenant_suspended',
                    'message' => 'Your account has been suspended. Please contact support.',
                    'lock_reason' => $lockData['lock_reason'],
                ], 403);
            }
        }

        return $next($request);
    }
}
