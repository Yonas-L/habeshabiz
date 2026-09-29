<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PlatformWaitlist;
use App\Models\PlatformWhitelist;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AdminWaitlistController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = PlatformWaitlist::query()->orderByDesc('created_at');

        if ($request->has('consented') && $request->query('consented') !== '') {
            $query->where('consented', filter_var($request->query('consented'), FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        $waitlist = $query->paginate(20);

        return response()->json([
            'data' => $waitlist->items(),
            'pagination' => [
                'current_page' => $waitlist->currentPage(),
                'last_page' => $waitlist->lastPage(),
                'per_page' => $waitlist->perPage(),
                'total' => $waitlist->total(),
            ],
        ]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'string', Rule::in(['pending', 'contacted', 'approved'])],
        ]);

        $waitlist = PlatformWaitlist::findOrFail($id);
        $newStatus = $validated['status'];
        $admin = $request->user();

        DB::transaction(function () use ($waitlist, $newStatus, $admin): void {
            $updateData = ['status' => $newStatus];

            if ($newStatus === 'contacted' && ! $waitlist->contacted_at) {
                $updateData['contacted_at'] = now();
            }

            if ($newStatus === 'approved') {
                if (! $waitlist->contacted_at) {
                    $updateData['contacted_at'] = now();
                }

                $email = strtolower(trim($waitlist->email));

                // Add to whitelist if not already present
                $exists = PlatformWhitelist::whereRaw('LOWER(email) = ?', [$email])->exists();

                if (! $exists) {
                    PlatformWhitelist::create([
                        'email' => $email,
                        'notes' => 'Approved from waitlist ('.$waitlist->name.')',
                        'status' => 'pending',
                        'created_by' => $admin?->id,
                    ]);
                }
            }

            $waitlist->update($updateData);
        });

        return response()->json([
            'message' => 'Waitlist entry updated successfully.',
            'entry' => $waitlist->fresh(),
        ]);
    }
}
