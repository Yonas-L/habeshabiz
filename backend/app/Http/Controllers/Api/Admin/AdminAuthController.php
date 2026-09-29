<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PlatformAdmin;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AdminAuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        $admin = PlatformAdmin::where('email', strtolower(trim($validated['email'])))->first();

        if (! $admin || ! Hash::check($validated['password'], $admin->password)) {
            return response()->json([
                'message' => 'Invalid credentials',
            ], 401);
        }

        $admin->update([
            'last_login_at' => now(),
        ]);

        $token = $admin->createToken('platform_admin_token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'admin' => [
                'id' => $admin->id,
                'name' => $admin->name,
                'email' => $admin->email,
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $admin = $request->user();

        if ($admin && method_exists($admin, 'currentAccessToken')) {
            $admin->currentAccessToken()?->delete();
        }

        return response()->json([
            'message' => 'Logged out successfully',
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $admin = $request->user();

        return response()->json([
            'admin' => [
                'id' => $admin->id,
                'name' => $admin->name,
                'email' => $admin->email,
                'last_login_at' => $admin->last_login_at,
            ],
        ]);
    }
}
