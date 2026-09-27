<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    /**
     * Get paginated audit logs with search, filters, and metadata (Owner / Super Admin only).
     */
    public function index(Request $request): JsonResponse
    {
        /** @var User|null $currentUser */
        $currentUser = $request->user();

        if (! $currentUser || ! $currentUser->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only business owners and super admins can access the system audit logs.',
            ], 403);
        }

        $query = AuditLog::with('user:id,name,email,role');

        // Search filter (action, entity_type, entity_id, user name, ip_address, description in new_values)
        if ($request->filled('search')) {
            $term = mb_strtolower(trim($request->query('search')));
            $query->where(function ($q) use ($term) {
                $q->whereRaw('LOWER(action) LIKE ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(entity_type) LIKE ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(entity_id) LIKE ?', ["%{$term}%"])
                  ->orWhereRaw('LOWER(ip_address) LIKE ?', ["%{$term}%"])
                  ->orWhereHas('user', function ($uq) use ($term) {
                      $uq->whereRaw('LOWER(name) LIKE ?', ["%{$term}%"])
                         ->orWhereRaw('LOWER(email) LIKE ?', ["%{$term}%"]);
                  })
                  ->orWhereRaw('LOWER(CAST(new_values AS text)) LIKE ?', ["%{$term}%"]);
            });
        }

        // Action filter
        if ($request->filled('action') && $request->query('action') !== 'all') {
            $query->where('action', $request->query('action'));
        }

        // Entity type filter
        if ($request->filled('entity_type') && $request->query('entity_type') !== 'all') {
            $query->where('entity_type', $request->query('entity_type'));
        }

        // User filter
        if ($request->filled('user_id') && $request->query('user_id') !== 'all') {
            $query->where('user_id', $request->query('user_id'));
        }

        // Date range filters
        if ($request->filled('start_date')) {
            $start = Carbon::parse($request->query('start_date'))->startOfDay();
            $query->where('created_at', '>=', $start);
        }

        if ($request->filled('end_date')) {
            $end = Carbon::parse($request->query('end_date'))->endOfDay();
            $query->where('created_at', '<=', $end);
        }

        // Sort by created_at desc
        $query->orderBy('created_at', 'desc');

        // Pagination
        $perPage = min(max((int) $request->query('per_page', 20), 1), 100);
        $paginated = $query->paginate($perPage);

        // Quick aggregate metadata
        $todayStart = now()->startOfDay();
        $todayCount = AuditLog::where('created_at', '>=', $todayStart)->count();
        $totalCount = AuditLog::count();

        // Distinct actions and entity types for quick filter pills
        $distinctActions = AuditLog::distinct()->pluck('action')->filter()->values();
        $distinctEntities = AuditLog::distinct()->pluck('entity_type')->filter()->values();
        $distinctUsers = User::select('id', 'name', 'role')->get();

        return response()->json([
            'success' => true,
            'data' => [
                'items' => $paginated->items(),
                'pagination' => [
                    'current_page' => $paginated->currentPage(),
                    'last_page' => $paginated->lastPage(),
                    'per_page' => $paginated->perPage(),
                    'total' => $paginated->total(),
                    'from' => $paginated->firstItem(),
                    'to' => $paginated->lastItem(),
                    'has_more' => $paginated->hasMorePages(),
                ],
                'summary' => [
                    'total_count' => $totalCount,
                    'today_count' => $todayCount,
                    'filtered_count' => $paginated->total(),
                ],
                'filter_options' => [
                    'actions' => $distinctActions,
                    'entity_types' => $distinctEntities,
                    'users' => $distinctUsers,
                ],
            ],
        ]);
    }
}
