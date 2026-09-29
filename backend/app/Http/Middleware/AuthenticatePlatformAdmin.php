<?php

namespace App\Http\Middleware;

use App\Models\PlatformAdmin;
use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

class AuthenticatePlatformAdmin
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $bearerToken = $request->bearerToken();

        if (! $bearerToken) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $accessToken = PersonalAccessToken::findToken($bearerToken);

        if (! $accessToken || ! $accessToken->tokenable instanceof PlatformAdmin) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        // Record last used time for the token
        $accessToken->forceFill(['last_used_at' => now()])->save();

        $admin = $accessToken->tokenable;

        $request->setUserResolver(fn () => $admin);

        return $next($request);
    }
}
