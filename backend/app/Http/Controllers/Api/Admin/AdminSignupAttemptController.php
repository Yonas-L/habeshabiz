<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PlatformSignupAttempt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminSignupAttemptController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $cutoff = now()->subDays(90);

        $query = PlatformSignupAttempt::query()
            ->where('created_at', '>=', $cutoff)
            ->orderByDesc('created_at');

        if ($request->filled('outcome')) {
            $query->where('outcome', $request->query('outcome'));
        }

        $attempts = $query->paginate(20);

        return response()->json([
            'data' => $attempts->items(),
            'pagination' => [
                'current_page' => $attempts->currentPage(),
                'last_page' => $attempts->lastPage(),
                'per_page' => $attempts->perPage(),
                'total' => $attempts->total(),
            ],
        ]);
    }
}
