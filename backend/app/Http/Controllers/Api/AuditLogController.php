<?php

namespace App\Http\Controllers\Api;

use App\Actions\Undo\UndoActionFactory;
use App\Exceptions\UndoBlockedException;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

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

        $query = AuditLog::with(['user:id,name,email,role', 'revertedByUser:id,name,email']);

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
        $distinctUsers = User::where('tenant_id', $currentUser->tenant_id)->select('id', 'name', 'role')->get();

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

    /**
     * Preview the consequences and blockers of undoing an audit action.
     */
    public function undoPreview(Request $request, string $id): JsonResponse
    {
        /** @var User|null $currentUser */
        $currentUser = $request->user();

        if (! $currentUser || ! $currentUser->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Reversing business actions is strictly restricted to store owners.',
            ], 403);
        }

        $log = AuditLog::with(['user', 'revertedByUser'])->findOrFail($id);

        if ($log->isReverted()) {
            return response()->json([
                'success' => false,
                'message' => 'This action has already been undone.',
                'is_reverted' => true,
                'reverted_at' => $log->reverted_at?->toIso8601String(),
                'reverted_by' => $log->revertedByUser?->name,
            ], 422);
        }

        if (! $log->isWithinUndoWindow()) {
            return response()->json([
                'success' => false,
                'message' => 'Action cannot be undone: the 24-hour undo window has expired.',
                'expired' => true,
            ], 422);
        }

        if (! UndoActionFactory::isUndoable($log->action)) {
            return response()->json([
                'success' => false,
                'message' => "Action '{$log->action}' does not support automatic undo.",
            ], 422);
        }

        $action = UndoActionFactory::make($log->action);
        $preview = $action->preview($log);

        return response()->json([
            'success' => true,
            'data' => $preview,
        ]);
    }

    /**
     * Execute the atomic undo of an audit action.
     */
    public function undo(Request $request, string $id): JsonResponse
    {
        /** @var User|null $currentUser */
        $currentUser = $request->user();

        if (! $currentUser || ! $currentUser->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Reversing business actions is strictly restricted to store owners.',
            ], 403);
        }

        $log = AuditLog::with(['user', 'revertedByUser'])->findOrFail($id);

        if ($log->isReverted()) {
            return response()->json([
                'success' => false,
                'message' => 'This action has already been undone.',
                'is_reverted' => true,
                'reverted_at' => $log->reverted_at?->toIso8601String(),
                'reverted_by' => $log->revertedByUser?->name,
            ], 422);
        }

        if (! $log->isWithinUndoWindow()) {
            return response()->json([
                'success' => false,
                'message' => 'Action cannot be undone: the 24-hour undo window has expired.',
                'expired' => true,
            ], 422);
        }

        if (! UndoActionFactory::isUndoable($log->action)) {
            return response()->json([
                'success' => false,
                'message' => "Action '{$log->action}' does not support automatic undo.",
            ], 422);
        }

        try {
            $action = UndoActionFactory::make($log->action);
            $message = $action->execute($log);

            return response()->json([
                'success' => true,
                'message' => $message,
                'data' => [
                    'id' => $log->id,
                    'is_reverted' => true,
                    'reverted_at' => now()->toIso8601String(),
                    'reverted_by' => $currentUser->name,
                ],
            ]);
        } catch (UndoBlockedException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'blocked' => true,
                'blocked_reasons' => $e->getBlockedReasons(),
            ], 422);
        } catch (Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Undo failed: '.$e->getMessage(),
            ], 500);
        }
    }
}
