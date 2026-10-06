<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlatformSetting;
use App\Models\PlatformSignupAttempt;
use App\Models\PlatformWhitelist;
use App\Models\Tenant;
use App\Services\TenantOnboardingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class OnboardingController extends Controller
{
    public function __construct(
        protected TenantOnboardingService $onboardingService
    ) {}

    public function onboard(Request $request): JsonResponse
    {
        $isOpen = PlatformSetting::get('registration_open', 'false') === 'true';
        $email = strtolower(trim((string) $request->input('owner_email', '')));
        $businessName = $request->input('business_name');

        $whitelistEntry = null;

        if (! $isOpen) {
            $whitelistEntry = PlatformWhitelist::pending()
                ->where(function ($q) use ($email) {
                    $q->where('email', $email)->orWhereRaw('LOWER(email) = ?', [$email]);
                })
                ->first();

            if (! $whitelistEntry) {
                $attempt = PlatformSignupAttempt::create([
                    'email' => $request->input('owner_email') ?: '',
                    'business_name' => $businessName,
                    'outcome' => 'waitlisted',
                    'created_at' => now(),
                ]);

                return response()->json([
                    'error' => 'not_whitelisted',
                    'message' => 'This email is not on the access list.',
                    'attempt_id' => $attempt->id,
                ], 403);
            }
        }

        $validated = $request->validate([
            'business_type' => ['required', 'string', Rule::in(['electronics', 'general_retail', 'clothing', 'food_beverage'])],
            'business_name' => ['required', 'string', 'max:100'],
            'owner_name' => ['required', 'string', 'max:100'],
            'owner_phone' => ['required', 'string', 'max:25'],
            'owner_email' => ['required', 'string', 'email', 'max:100', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
            'city' => ['required', 'string', 'max:100'],
            'team_size' => ['required', 'string'],
            'logo' => ['nullable', 'image', 'mimes:jpeg,png,jpg,webp,svg', 'max:2048'],
            'logo_url' => ['nullable', 'string', 'max:2048'],
        ]);

        if ($request->hasFile('logo')) {
            $validated['logo_url'] = Tenant::convertUploadedFileToDataUri($request->file('logo'));
        }

        $result = DB::transaction(function () use ($validated, $whitelistEntry, $email, $businessName) {
            $onboardingResult = $this->onboardingService->onboard($validated);

            if ($whitelistEntry) {
                $whitelistEntry->update([
                    'status' => 'used',
                    'used_at' => now(),
                ]);

                PlatformSignupAttempt::create([
                    'email' => $email,
                    'business_name' => $businessName,
                    'outcome' => 'success',
                    'created_at' => now(),
                ]);
            }

            return $onboardingResult;
        });

        return response()->json([
            'success' => true,
            'message' => 'Workspace created and initialized successfully.',
            'data' => [
                'token' => $result['token'],
                'user' => [
                    'id' => $result['user']->id,
                    'name' => $result['user']->name,
                    'email' => $result['user']->email,
                    'phone' => $result['user']->phone,
                    'role' => $result['user']->role,
                    'permissions' => $result['user']->permissions ?? [],
                    'can_view_costs' => $result['user']->canViewCosts(),
                    'can_discount' => $result['user']->canDiscount(),
                    'can_handover' => $result['user']->canHandover(),
                    'can_intake_stock' => $result['user']->canIntakeStock(),
                    'can_manage_inventory' => $result['user']->canManageInventory(),
                ],
                'tenant' => [
                    'id' => $result['tenant']->id,
                    'name' => $result['tenant']->name,
                    'slug' => $result['tenant']->slug,
                    'currency' => $result['tenant']->currency_code,
                    'business_type' => $result['tenant']->business_type,
                    'settings' => $result['tenant']->settings,
                ],
            ],
        ], 201);
    }
}
