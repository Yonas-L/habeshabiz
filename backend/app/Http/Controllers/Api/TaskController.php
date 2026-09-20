<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StaffTask;
use App\Scopes\TenantScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaskController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tasks = StaffTask::where('user_id', $request->user()->id)
            ->latest()
            ->get();

        return response()->json([
            'success' => true,
            'data' => $tasks,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'priority' => ['nullable', 'string', 'in:high,normal,low'],
            'due_date' => ['nullable', 'date'],
        ]);

        $task = StaffTask::create([
            'tenant_id' => TenantScope::getActiveTenantId(),
            'user_id' => $request->user()->id,
            'title' => $validated['title'],
            'priority' => $validated['priority'] ?? 'normal',
            'due_date' => $validated['due_date'] ?? null,
            'is_completed' => false,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Task added to checklist.',
            'data' => $task,
        ], 201);
    }

    public function toggle(Request $request, string $id): JsonResponse
    {
        $task = StaffTask::where('user_id', $request->user()->id)->findOrFail($id);
        $task->update(['is_completed' => ! $task->is_completed]);

        return response()->json([
            'success' => true,
            'message' => $task->is_completed ? 'Task completed!' : 'Task marked pending.',
            'data' => $task,
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $task = StaffTask::where('user_id', $request->user()->id)->findOrFail($id);
        $task->delete();

        return response()->json([
            'success' => true,
            'message' => 'Task removed.',
        ]);
    }
}
