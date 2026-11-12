<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BankLogo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BankLogoController extends Controller
{
    /**
     * Get platform bank logos for tenant account selection.
     */
    public function index(Request $request): JsonResponse
    {
        $query = BankLogo::orderBy('sort_order', 'asc')
            ->orderBy('created_at', 'desc')
            ->select(['id', 'category', 'name', 'logo_url']);

        if ($request->filled('category') && $request->input('category') !== 'all') {
            $query->where('category', $request->input('category'));
        }

        $logos = $query->get();

        return response()->json([
            'success' => true,
            'data' => $logos,
        ]);
    }
}
