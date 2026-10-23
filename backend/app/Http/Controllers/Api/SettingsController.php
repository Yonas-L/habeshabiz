<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
                    'default_signature_url' => $settings['default_signature_url'] ?? null,
                    'default_stamp_url' => $settings['default_stamp_url'] ?? null,
                    'signature_stamp_preferences' => $settings['signature_stamp_preferences'] ?? [
                        'auto_embed_sales_invoice' => true,
                        'auto_embed_proforma' => true,
                        'auto_embed_vendor_statement' => true,
                        'default_signature_size' => ['width' => 22, 'height' => 10],
                        'default_stamp_size' => ['width' => 24, 'height' => 18],
                    ],
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
                    'default_signature_url' => $settings['default_signature_url'] ?? null,
                    'default_stamp_url' => $settings['default_stamp_url'] ?? null,
                    'signature_stamp_preferences' => $settings['signature_stamp_preferences'] ?? [
                        'auto_embed_sales_invoice' => true,
                        'auto_embed_proforma' => true,
                        'auto_embed_vendor_statement' => true,
                        'default_signature_size' => ['width' => 22, 'height' => 10],
                        'default_stamp_size' => ['width' => 24, 'height' => 18],
                    ],
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
     * Upload business logo image and store in persistent database settings.
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

        $url = Tenant::convertUploadedFileToDataUri($request->file('logo'));

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

    /**
     * Save authorized handwritten signature (file upload or canvas transparent data URI).
     */
    public function uploadSignature(Request $request): JsonResponse
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
            'signature_file' => ['nullable', 'image', 'mimes:jpeg,png,jpg,webp,svg', 'max:4096'],
            'signature_data' => ['nullable', 'string'],
        ]);

        /** @var Tenant $tenant */
        $tenant = $user->tenant;

        $url = null;
        if ($request->hasFile('signature_file')) {
            $url = Tenant::convertUploadedFileToDataUri($request->file('signature_file'));
        } elseif ($request->filled('signature_data')) {
            $data = $request->input('signature_data');
            if (! str_starts_with($data, 'data:image/')) {
                return response()->json(['success' => false, 'message' => 'Invalid signature data format.'], 422);
            }
            $url = $data;
        } else {
            return response()->json(['success' => false, 'message' => 'No signature provided.'], 422);
        }

        $settings = $tenant->settings ?? [];
        $settings['default_signature_url'] = $url;
        $tenant->update(['settings' => $settings]);

        AuditLog::record(
            action: 'signature_saved',
            entityType: 'Tenant',
            entityId: $tenant->id,
            newValues: ['default_signature_url' => 'Signature updated']
        );

        return response()->json([
            'success' => true,
            'message' => 'Digital signature saved successfully.',
            'data' => [
                'signature_url' => $url,
            ],
        ]);
    }

    /**
     * Delete stored authorized signature.
     */
    public function deleteSignature(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->role !== 'owner') {
            return response()->json(['success' => false, 'message' => 'Access denied.'], 403);
        }

        /** @var Tenant $tenant */
        $tenant = $user->tenant;
        $settings = $tenant->settings ?? [];
        $settings['default_signature_url'] = null;
        $tenant->update(['settings' => $settings]);

        AuditLog::record(
            action: 'signature_deleted',
            entityType: 'Tenant',
            entityId: $tenant->id,
            newValues: ['default_signature_url' => null]
        );

        return response()->json([
            'success' => true,
            'message' => 'Authorized signature removed.',
        ]);
    }

    /**
     * Save company stamp (file upload or processed transparent canvas data URI).
     */
    public function uploadStamp(Request $request): JsonResponse
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
            'stamp_file' => ['nullable', 'image', 'mimes:jpeg,png,jpg,webp,svg', 'max:5120'],
            'stamp_data' => ['nullable', 'string'],
        ]);

        /** @var Tenant $tenant */
        $tenant = $user->tenant;

        $url = null;
        if ($request->hasFile('stamp_file')) {
            $url = Tenant::convertUploadedFileToDataUri($request->file('stamp_file'));
        } elseif ($request->filled('stamp_data')) {
            $data = $request->input('stamp_data');
            if (! str_starts_with($data, 'data:image/')) {
                return response()->json(['success' => false, 'message' => 'Invalid stamp data format.'], 422);
            }
            $url = $data;
        } else {
            return response()->json(['success' => false, 'message' => 'No company stamp provided.'], 422);
        }

        $settings = $tenant->settings ?? [];
        $settings['default_stamp_url'] = $url;
        $tenant->update(['settings' => $settings]);

        AuditLog::record(
            action: 'stamp_saved',
            entityType: 'Tenant',
            entityId: $tenant->id,
            newValues: ['default_stamp_url' => 'Company stamp updated']
        );

        return response()->json([
            'success' => true,
            'message' => 'Company stamp saved successfully.',
            'data' => [
                'stamp_url' => $url,
            ],
        ]);
    }

    /**
     * Delete stored company stamp.
     */
    public function deleteStamp(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->role !== 'owner') {
            return response()->json(['success' => false, 'message' => 'Access denied.'], 403);
        }

        /** @var Tenant $tenant */
        $tenant = $user->tenant;
        $settings = $tenant->settings ?? [];
        $settings['default_stamp_url'] = null;
        $tenant->update(['settings' => $settings]);

        AuditLog::record(
            action: 'stamp_deleted',
            entityType: 'Tenant',
            entityId: $tenant->id,
            newValues: ['default_stamp_url' => null]
        );

        return response()->json([
            'success' => true,
            'message' => 'Company stamp removed.',
        ]);
    }

    /**
     * Update document automation and signature/stamp placement preferences.
     */
    public function updateSignatureStampPreferences(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->role !== 'owner') {
            return response()->json(['success' => false, 'message' => 'Access denied.'], 403);
        }

        $validated = $request->validate([
            'preferences' => ['required', 'array'],
            'preferences.auto_embed_sales_invoice' => ['nullable', 'boolean'],
            'preferences.auto_embed_proforma' => ['nullable', 'boolean'],
            'preferences.auto_embed_vendor_statement' => ['nullable', 'boolean'],
            'preferences.default_signature_size' => ['nullable', 'array'],
            'preferences.default_stamp_size' => ['nullable', 'array'],
        ]);

        /** @var Tenant $tenant */
        $tenant = $user->tenant;
        $settings = $tenant->settings ?? [];
        $currentPrefs = $settings['signature_stamp_preferences'] ?? [];
        $newPrefs = array_merge($currentPrefs, $validated['preferences']);
        $settings['signature_stamp_preferences'] = $newPrefs;
        $tenant->update(['settings' => $settings]);

        return response()->json([
            'success' => true,
            'message' => 'Signature and stamp preferences updated.',
            'data' => [
                'preferences' => $newPrefs,
            ],
        ]);
    }
}
