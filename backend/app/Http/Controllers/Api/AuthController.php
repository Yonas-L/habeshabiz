<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::with('tenant')->where('email', $validated['email'])->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials do not match our records.'],
            ]);
        }

        if (! $user->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'Your user account is deactivated.',
            ], 403);
        }

        // Track device info
        $deviceInfo = \App\Support\DeviceDetector::parse($request->userAgent());
        $user->update([
            'last_device' => $deviceInfo['platform'],
            'last_device_type' => $deviceInfo['type'],
            'last_browser' => $deviceInfo['browser'],
            'last_login_ip' => $request->ip(),
            'last_login_at' => now(),
        ]);

        $token = $user->createToken('habeshabiz_api_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Authenticated successfully.',
            'data' => [
                'token' => $token,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'role' => $user->role,
                    'permissions' => $user->permissions ?? [],
                    'can_view_costs' => $user->canViewCosts(),
                    'can_discount' => $user->canDiscount(),
                    'can_handover' => $user->canHandover(),
                    'can_intake_stock' => $user->canIntakeStock(),
                    'can_manage_inventory' => $user->canManageInventory(),
                ],
                'tenant' => $user->tenant ? [
                    'id' => $user->tenant->id,
                    'name' => $user->tenant->name,
                    'slug' => $user->tenant->slug,
                    'phone' => $user->tenant->phone,
                    'currency' => $user->tenant->currency_code,
                    'business_type' => $user->tenant->business_type,
                    'settings' => $user->tenant->settings,
                ] : null,
            ],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user()->load('tenant');

        return response()->json([
            'success' => true,
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'role' => $user->role,
                    'permissions' => $user->permissions ?? [],
                    'can_view_costs' => $user->canViewCosts(),
                    'can_discount' => $user->canDiscount(),
                    'can_handover' => $user->canHandover(),
                    'can_intake_stock' => $user->canIntakeStock(),
                    'can_manage_inventory' => $user->canManageInventory(),
                ],
                'tenant' => $user->tenant ? [
                    'id' => $user->tenant->id,
                    'name' => $user->tenant->name,
                    'slug' => $user->tenant->slug,
                    'phone' => $user->tenant->phone,
                    'currency' => $user->tenant->currency_code,
                    'business_type' => $user->tenant->business_type,
                    'settings' => $user->tenant->settings,
                ] : null,
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $user->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully.',
        ]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'new_password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        if (! Hash::check($validated['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Current password is incorrect.'],
            ]);
        }

        $user->update([
            'password' => Hash::make($validated['new_password']),
        ]);

        AuditLog::record(
            action: 'password_changed',
            entityType: 'User',
            entityId: (string) $user->id,
            newValues: ['user' => $user->name]
        );

        return response()->json([
            'success' => true,
            'message' => 'Password updated successfully.',
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:25'],
        ]);

        $user->update($validated);

        AuditLog::record(
            action: 'profile_updated',
            entityType: 'User',
            entityId: (string) $user->id,
            newValues: $validated
        );

        return response()->json([
            'success' => true,
            'message' => 'Profile details updated.',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'role' => $user->role,
                'permissions' => $user->permissions ?? [],
                'can_view_costs' => $user->canViewCosts(),
                'can_discount' => $user->canDiscount(),
                'can_handover' => $user->canHandover(),
                'can_intake_stock' => $user->canIntakeStock(),
                'can_manage_inventory' => $user->canManageInventory(),
            ],
        ]);
    }
}
