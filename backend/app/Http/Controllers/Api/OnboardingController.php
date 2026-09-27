<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\TenantOnboardingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OnboardingController extends Controller
{
    public function __construct(
        protected TenantOnboardingService $onboardingService
    ) {}

    public function onboard(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'business_type' => ['required', 'string', Rule::in(['electronics', 'general_retail', 'clothing', 'food_beverage'])],
            'business_name' => ['required', 'string', 'max:100'],
            'owner_name' => ['required', 'string', 'max:100'],
            'owner_phone' => ['required', 'string', 'max:25'],
            'owner_email' => ['required', 'string', 'email', 'max:100', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
            'city' => ['required', 'string', 'max:100'],
            'team_size' => ['required', 'string'],
        ]);

        $result = $this->onboardingService->onboard($validated);

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
