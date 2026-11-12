<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\BankLogo;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

class AdminBankLogoController extends Controller
{
    /**
     * List all bank logos available on the platform, with optional category filter.
     */
    public function index(Request $request): JsonResponse
    {
        $query = BankLogo::orderBy('sort_order', 'asc')
            ->orderBy('created_at', 'desc');

        if ($request->filled('category') && $request->input('category') !== 'all') {
            $query->where('category', $request->input('category'));
        }

        $logos = $query->get();

        return response()->json([
            'success' => true,
            'data' => $logos,
        ]);
    }

    /**
     * Upload and store one or more bank logos under a specific category.
     * Supports single or batch uploads without requiring manual naming.
     */
    public function store(Request $request): JsonResponse
    {
        /** @var array<UploadedFile> $files */
        $files = [];

        if ($request->hasFile('files')) {
            $rawFiles = $request->file('files');
            $files = is_array($rawFiles) ? $rawFiles : [$rawFiles];
        } elseif ($request->hasFile('file')) {
            $files = [$request->file('file')];
        } elseif ($request->hasFile('logo')) {
            $files = [$request->file('logo')];
        } elseif ($request->hasFile('image')) {
            $files = [$request->file('image')];
        }

        if (empty($files)) {
            return response()->json([
                'success' => false,
                'message' => 'Please select at least one logo image to upload.',
            ], 422);
        }

        $category = $request->input('category', 'bank');
        $validCategories = ['bank', 'mobile_money', 'cash', 'asset_fx', 'asset_gold', 'custom'];
        if (! in_array($category, $validCategories, true)) {
            $category = 'bank';
        }

        $created = [];

        foreach ($files as $file) {
            if (! $file instanceof UploadedFile || ! $file->isValid()) {
                continue;
            }

            // Extract friendly display name from filename
            $rawName = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
            $cleanName = ucwords(trim(preg_replace('/[_\-]+/', ' ', $rawName) ?? ''));
            $displayName = ! empty($cleanName) ? $cleanName : 'Bank Logo';

            $dataUri = Tenant::convertUploadedFileToDataUri($file);

            $logo = BankLogo::create([
                'category' => $category,
                'name' => $displayName,
                'logo_url' => $dataUri,
                'sort_order' => 0,
            ]);

            $created[] = $logo;
        }

        return response()->json([
            'success' => true,
            'message' => count($created) === 1 ? 'Logo uploaded successfully.' : count($created).' logos uploaded successfully.',
            'data' => $created,
        ], 201);
    }

    /**
     * Update an existing logo's details (category, name, sort order).
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $logo = BankLogo::findOrFail($id);

        $validated = $request->validate([
            'name' => 'nullable|string|max:100',
            'category' => 'nullable|string|in:bank,mobile_money,cash,asset_fx,asset_gold,custom',
            'sort_order' => 'nullable|integer',
        ]);

        $logo->update(array_filter($validated, fn ($val) => $val !== null));

        return response()->json([
            'success' => true,
            'message' => 'Logo updated successfully.',
            'data' => $logo,
        ]);
    }

    /**
     * Remove a bank logo from the platform library.
     */
    public function destroy(string $id): JsonResponse
    {
        $logo = BankLogo::findOrFail($id);
        $logo->delete();

        return response()->json([
            'success' => true,
            'message' => 'Bank logo removed successfully.',
        ]);
    }
}
