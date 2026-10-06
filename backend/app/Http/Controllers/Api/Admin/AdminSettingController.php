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

        $defaults = [
            'registration_open' => 'false',
            'business_type_electronics_enabled' => 'true',
            'business_type_general_retail_enabled' => 'false',
            'business_type_clothing_enabled' => 'false',
            'business_type_food_beverage_enabled' => 'false',
        ];

        foreach ($defaults as $key => $defaultVal) {
            if (! isset($settings[$key])) {
                $settings[$key] = PlatformSetting::get($key, $defaultVal);
            }
        }

        return response()->json([
            'settings' => $settings,
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'key' => [
                'required',
                'string',
                Rule::in([
                    'registration_open',
                    'business_type_electronics_enabled',
                    'business_type_general_retail_enabled',
                    'business_type_clothing_enabled',
                    'business_type_food_beverage_enabled',
                ]),
            ],
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
