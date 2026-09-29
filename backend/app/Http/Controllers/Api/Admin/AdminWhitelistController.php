<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PlatformWhitelist;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminWhitelistController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = PlatformWhitelist::query()->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        $whitelist = $query->paginate(20);

        return response()->json([
            'data' => $whitelist->items(),
            'pagination' => [
                'current_page' => $whitelist->currentPage(),
                'last_page' => $whitelist->lastPage(),
                'per_page' => $whitelist->perPage(),
                'total' => $whitelist->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email', 'max:150'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $email = strtolower(trim($validated['email']));

        $exists = PlatformWhitelist::whereRaw('LOWER(email) = ?', [$email])->exists();

        if ($exists) {
            return response()->json([
                'message' => 'Email is already on the whitelist.',
            ], 409);
        }

        $admin = $request->user();

        $entry = PlatformWhitelist::create([
            'email' => $email,
            'notes' => $validated['notes'] ?? null,
            'status' => 'pending',
            'created_by' => $admin?->id,
        ]);

        return response()->json([
            'message' => 'Email added to whitelist.',
            'entry' => $entry,
        ], 201);
    }

    public function destroy(string $id): JsonResponse
    {
        $entry = PlatformWhitelist::findOrFail($id);

        if ($entry->status !== 'pending') {
            return response()->json([
                'message' => 'Only pending whitelist entries can be deleted.',
            ], 422);
        }

        $entry->delete();

        return response()->json([
            'message' => 'Whitelist entry removed successfully.',
        ]);
    }
}
