<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class SettingsController extends Controller
{
    /**
     * Get the tenant and owner profile settings.
     */
    public function getProfile(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->role !== 'owner') {
            return response()->json([
                'success' => false,
                'message' => 'Access denied. Owner privileges required.',
            ], 403);
        }

        /** @var Tenant $tenant */
        $tenant = $user->tenant;

        $settings = $tenant->settings ?? [];

        return response()->json([
            'success' => true,
            'data' => [
                'tenant' => [
                    'id' => $tenant->id,
                    'name' => $tenant->name,
                    'slug' => $tenant->slug,
                    'phone' => $tenant->phone,
                    'currency_code' => $tenant->currency_code,
                    'business_type' => $tenant->business_type,
                    'city' => $settings['city'] ?? 'Addis Ababa',
                    'address' => $settings['address'] ?? '',
                    'team_size' => $settings['team_size'] ?? '1',
                    'tin_number' => $settings['tin_number'] ?? '',
                    'logo_url' => $settings['logo_url'] ?? null,
                    'footer_note' => $settings['footer_note'] ?? '',
                    'secondary_currencies' => $settings['secondary_currencies'] ?? ['USD'],
                ],
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'role' => $user->role,
                ],
            ],
        ]);
    }

    /**
     * Update the business and owner profile settings.
     */
    public function updateProfile(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->role !== 'owner') {
            return response()->json([
                'success' => false,
                'message' => 'Access denied. Owner privileges required.',
            ], 403);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:25'],
            'currency_code' => ['sometimes', 'string', Rule::in(['ETB', 'USD', 'EUR'])],
            'city' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:255'],
            'tin_number' => ['nullable', 'string', 'max:50'],
            'footer_note' => ['nullable', 'string', 'max:1000'],
            'secondary_currencies' => ['nullable', 'array'],
            'secondary_currencies.*' => ['string', Rule::in(['ETB', 'USD', 'EUR', 'GBP', 'AED'])],
            'owner_name' => ['nullable', 'string', 'max:100'],
            'owner_phone' => ['nullable', 'string', 'max:25'],
        ]);

        /** @var Tenant $tenant */
        $tenant = $user->tenant;

        $settings = $tenant->settings ?? [];
        if (array_key_exists('city', $validated)) {
            $settings['city'] = $validated['city'];
        }
        if (array_key_exists('address', $validated)) {
            $settings['address'] = $validated['address'];
        }
        if (array_key_exists('tin_number', $validated)) {
            $settings['tin_number'] = $validated['tin_number'];
        }
        if (array_key_exists('footer_note', $validated)) {
            $settings['footer_note'] = $validated['footer_note'];
        }
        if (array_key_exists('secondary_currencies', $validated)) {
            $settings['secondary_currencies'] = $validated['secondary_currencies'];
        }

        $tenantUpdate = [
            'name' => $validated['name'],
            'phone' => $validated['phone'] ?? $tenant->phone,
            'settings' => $settings,
        ];

        if (! empty($validated['currency_code'])) {
            $tenantUpdate['currency_code'] = $validated['currency_code'];
        }

        $tenant->update($tenantUpdate);

        // Update owner details if provided
        if (! empty($validated['owner_name']) || array_key_exists('owner_phone', $validated)) {
            $userUpdate = [];
            if (! empty($validated['owner_name'])) {
                $userUpdate['name'] = $validated['owner_name'];
            }
            if (array_key_exists('owner_phone', $validated)) {
                $userUpdate['phone'] = $validated['owner_phone'];
            }
            $user->update($userUpdate);
        }

        AuditLog::record(
            action: 'settings_updated',
            entityType: 'Tenant',
            entityId: $tenant->id,
            newValues: [
                'name' => $tenant->name,
                'phone' => $tenant->phone,
                'settings' => $settings,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Business profile updated successfully.',
            'data' => [
                'tenant' => [
                    'id' => $tenant->id,
                    'name' => $tenant->name,
                    'slug' => $tenant->slug,
                    'phone' => $tenant->phone,
                    'currency_code' => $tenant->currency_code,
                    'business_type' => $tenant->business_type,
                    'city' => $settings['city'] ?? '',
                    'address' => $settings['address'] ?? '',
                    'team_size' => $settings['team_size'] ?? '',
                    'tin_number' => $settings['tin_number'] ?? '',
                    'logo_url' => $settings['logo_url'] ?? null,
                    'footer_note' => $settings['footer_note'] ?? '',
                    'secondary_currencies' => $settings['secondary_currencies'] ?? ['USD'],
                ],
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'role' => $user->role,
                ],
            ],
        ]);
    }

    /**
     * Upload business logo image and store in filesystem.
     */
    public function uploadLogo(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->role !== 'owner') {
            return response()->json([
                'success' => false,
                'message' => 'Access denied. Owner privileges required.',
            ], 403);
        }

        $request->validate([
            'logo' => ['required', 'image', 'mimes:jpeg,png,jpg,webp,svg', 'max:2048'],
        ]);

        /** @var Tenant $tenant */
        $tenant = $user->tenant;

        $path = $request->file('logo')->store('logos', 'public');
        $url = Tenant::normalizeStorageUrl('/storage/' . $path);

        $settings = $tenant->settings ?? [];
        $settings['logo_url'] = $url;
        $tenant->update(['settings' => $settings]);

        AuditLog::record(
            action: 'logo_uploaded',
            entityType: 'Tenant',
            entityId: $tenant->id,
            newValues: ['logo_url' => $url]
        );

        return response()->json([
            'success' => true,
            'message' => 'Logo uploaded successfully.',
            'data' => [
                'logo_url' => $url,
            ],
        ]);
    }
}
