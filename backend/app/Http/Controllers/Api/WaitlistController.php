<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlatformSignupAttempt;
use App\Models\PlatformWaitlist;
use App\Services\TelegramNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WaitlistController extends Controller
{
    public function __construct(
        protected TelegramNotificationService $telegramService
    ) {}

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'string', 'email', 'max:150'],
            'phone' => ['nullable', 'string', 'max:30'],
            'business_name' => ['nullable', 'string', 'max:100'],
            'message' => ['nullable', 'string', 'max:500'],
            'consented' => ['required', 'boolean'],
            'attempt_id' => ['nullable', 'string'],
        ]);

        $consented = (bool) $validated['consented'];
        $attemptId = $validated['attempt_id'] ?? null;

        if ($consented) {
            $waitlist = PlatformWaitlist::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'phone' => $validated['phone'] ?? null,
                'business_name' => $validated['business_name'] ?? null,
                'message' => $validated['message'] ?? null,
                'consented' => true,
                'status' => 'pending',
            ]);

            // If attempt_id was not provided, log a signup attempt
            if (! $attemptId) {
                PlatformSignupAttempt::create([
                    'email' => $validated['email'],
                    'business_name' => $validated['business_name'] ?? null,
                    'outcome' => 'waitlisted',
                    'created_at' => now(),
                ]);
            }

            $this->telegramService->notifyWaitlistSubmission($waitlist);

            return response()->json([
                'message' => 'You have been added to the waitlist.',
            ], 201);
        }

        // If consented is false
        if ($attemptId) {
            PlatformSignupAttempt::where('id', $attemptId)->update([
                'outcome' => 'opted_out',
            ]);
        }

        $this->telegramService->notifyOptedOut(
            $validated['email'],
            $validated['business_name'] ?? null
        );

        return response()->json([
            'message' => 'Understood. Your information has not been saved.',
        ], 200);
    }
}
