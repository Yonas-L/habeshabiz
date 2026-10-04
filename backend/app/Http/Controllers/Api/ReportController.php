<?php

namespace App\Http\Controllers\Api;

use App\Actions\GenerateBusinessReportAction;
use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function summary(Request $request, GenerateBusinessReportAction $report): JsonResponse
    {
        $user = $request->user();
        if (! $user || ! $user->isOwner()) {
            return response()->json([
                'success' => false,
                'message' => 'Only business owners can view financial reports.',
            ], 403);
        }

        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $from = isset($validated['from'])
            ? Carbon::parse($validated['from'])
            : now()->startOfMonth();
        $to = isset($validated['to'])
            ? Carbon::parse($validated['to'])
            : now();

        return response()->json([
            'success' => true,
            'data' => $report->execute($from, $to),
        ]);
    }
}
