<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use App\Scopes\TenantScope;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

class ForgotPasswordController extends Controller
{
    /**
     * Send a password reset link to the given user.
     */
    public function sendResetLink(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'email'],
        ]);

        $status = Password::broker()->sendResetLink(
            $request->only('email')
        );

        if ($status === Password::RESET_THROTTLED) {
            return response()->json([
                'success' => false,
                'message' => 'Please wait before requesting another reset link.',
            ], 429);
        }

        // Return a generic success message to prevent user enumeration
        return response()->json([
            'success' => true,
            'message' => 'If your email is registered, you will receive a password reset link shortly.',
        ]);
    }

    /**
     * Reset the user's password using the provided token.
     */
    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $status = Password::broker()->reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password): void {
                $user->forceFill([
                    'password' => Hash::make($password),
                ])->setRememberToken(Str::random(60));

                $user->save();

                // Revoke all existing Sanctum bearer tokens for enhanced security
                $user->tokens()->delete();

                event(new PasswordReset($user));

                if ($user->tenant_id) {
                    $previousTenant = TenantScope::getActiveTenantId();
                    TenantScope::setForcedTenantId($user->tenant_id);

                    AuditLog::record(
                        action: 'password_reset_completed',
                        entityType: 'User',
                        entityId: (string) $user->id,
                        newValues: ['email' => $user->email, 'name' => $user->name],
                        userId: $user->id
                    );

                    TenantScope::setForcedTenantId($previousTenant);
                }
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json([
                'success' => true,
                'message' => 'Your password has been reset successfully. You may now log in.',
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => __($status),
        ], 422);
    }
}
