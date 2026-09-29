<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PlatformSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminSettingController extends Controller
{
    public function index(): JsonResponse
    {
        $settings = PlatformSetting::all()->pluck('value', 'key')->toArray();

        // Ensure default is always present
        if (! isset($settings['registration_open'])) {
            $settings['registration_open'] = PlatformSetting::get('registration_open', 'false');
        }

        return response()->json([
            'settings' => $settings,
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'key' => ['required', 'string', Rule::in(['registration_open'])],
            'value' => ['required', 'string', Rule::in(['true', 'false'])],
        ]);

        PlatformSetting::set($validated['key'], $validated['value']);

        return response()->json([
            'message' => 'Platform setting updated successfully.',
            'key' => $validated['key'],
            'value' => $validated['value'],
        ]);
    }
}
