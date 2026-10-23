<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\ProformaInvoice;
use App\Models\Tenant;
use App\Models\User;
use App\Services\PdfGeneratorService;
use App\Services\ProformaCalculationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProformaInvoiceController extends Controller
{
    public function __construct(
        protected ProformaCalculationService $calculationService,
        protected PdfGeneratorService $pdfService
    ) {}

    /**
     * List all proforma invoices with filtering and KPI metrics.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $query = ProformaInvoice::with(['customer', 'creator', 'bankAccount', 'items'])
            ->orderByDesc('issue_date')
            ->orderByDesc('created_at');

        // Status filter
        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // Search filter (number, customer, reference)
        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where(function ($q) use ($search) {
                $q->where('proforma_number', 'LIKE', "%{$search}%")
                    ->orWhere('customer_name', 'LIKE', "%{$search}%")
                    ->orWhere('customer_phone', 'LIKE', "%{$search}%")
                    ->orWhere('reference_number', 'LIKE', "%{$search}%");
            });
        }

        // Date range
        if ($request->filled('start_date')) {
            $query->whereDate('issue_date', '>=', $request->start_date);
        }
        if ($request->filled('end_date')) {
            $query->whereDate('issue_date', '<=', $request->end_date);
        }

        $perPage = min(100, max(10, (int) $request->input('per_page', 20)));
        $invoices = $query->paginate($perPage);

        // Compute summary metrics for active tenant
        $allInvoices = ProformaInvoice::all();
        $metrics = [
            'total_count' => $allInvoices->count(),
            'total_value' => (float) $allInvoices->sum('total_amount'),
            'pending_count' => $allInvoices->whereIn('status', ['draft', 'sent'])->count(),
            'pending_value' => (float) $allInvoices->whereIn('status', ['draft', 'sent'])->sum('total_amount'),
            'accepted_count' => $allInvoices->where('status', 'accepted')->count(),
            'accepted_value' => (float) $allInvoices->where('status', 'accepted')->sum('total_amount'),
            'converted_count' => $allInvoices->where('status', 'converted_to_sale')->count(),
            'expired_count' => $allInvoices->where('status', 'expired')->count(),
        ];

        return response()->json([
            'success' => true,
            'data' => $invoices->items(),
            'meta' => [
                'current_page' => $invoices->currentPage(),
                'last_page' => $invoices->lastPage(),
                'per_page' => $invoices->perPage(),
                'total' => $invoices->total(),
            ],
            'metrics' => $metrics,
        ]);
    }

    /**
     * Store a newly created proforma invoice.
     */
    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        /** @var Tenant $tenant */
        $tenant = $user->tenant;

        $validated = $request->validate([
            'customer_name' => ['required', 'string', 'max:255'],
            'customer_id' => ['nullable', 'uuid', 'exists:contacts,id'],
            'customer_phone' => ['nullable', 'string', 'max:50'],
            'customer_email' => ['nullable', 'email', 'max:255'],
            'customer_address' => ['nullable', 'string', 'max:500'],
            'customer_tin' => ['nullable', 'string', 'max:50'],
            'issue_date' => ['required', 'date'],
            'valid_until' => ['nullable', 'date', 'after_or_equal:issue_date'],
            'currency' => ['nullable', 'string', 'max:10'],
            'status' => ['nullable', 'string', Rule::in(['draft', 'sent', 'accepted', 'expired', 'converted_to_sale'])],
            'vat_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'withholding_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'shipping_fee' => ['nullable', 'numeric', 'min:0'],
            'payment_terms' => ['nullable', 'string', 'max:255'],
            'payment_method' => ['nullable', 'string', 'max:100'],
            'bank_account_id' => ['nullable', 'uuid', 'exists:financial_accounts,id'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'prepared_by' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:3000'],
            'delivery_terms' => ['nullable', 'string', 'max:1000'],
            'signature_stamp_config' => ['nullable', 'array'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.description' => ['required', 'string', 'max:500'],
            'items.*.product_id' => ['nullable', 'uuid', 'exists:products,id'],
            'items.*.variant_id' => ['nullable', 'uuid', 'exists:product_variants,id'],
            'items.*.sku' => ['nullable', 'string', 'max:100'],
            'items.*.unit_of_measure' => ['nullable', 'string', 'max:30'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.01'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.discount_type' => ['nullable', 'string', Rule::in(['percentage', 'fixed'])],
            'items.*.discount_rate' => ['nullable', 'numeric', 'min:0'],
            'items.*.tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        $calculation = $this->calculationService->calculate($validated['items'], [
            'vat_rate' => $validated['vat_rate'] ?? 15.00,
            'withholding_rate' => $validated['withholding_rate'] ?? 0.00,
            'shipping_fee' => $validated['shipping_fee'] ?? 0.00,
        ]);

        $proformaNumber = ProformaInvoice::generateProformaNumber($tenant->id);

        $proforma = DB::transaction(function () use ($tenant, $user, $validated, $calculation, $proformaNumber) {
            $summary = $calculation['summary'];

            $invoice = ProformaInvoice::create([
                'tenant_id' => $tenant->id,
                'proforma_number' => $proformaNumber,
                'created_by_user_id' => $user->id,
                'customer_id' => $validated['customer_id'] ?? null,
                'customer_name' => $validated['customer_name'],
                'customer_phone' => $validated['customer_phone'] ?? null,
                'customer_email' => $validated['customer_email'] ?? null,
                'customer_address' => $validated['customer_address'] ?? null,
                'customer_tin' => $validated['customer_tin'] ?? null,
                'issue_date' => $validated['issue_date'],
                'valid_until' => $validated['valid_until'] ?? null,
                'currency' => $validated['currency'] ?? ($tenant->currency_code ?: 'ETB'),
                'status' => $validated['status'] ?? 'draft',
                'subtotal' => $summary['subtotal'],
                'discount_total' => $summary['discount_total'],
                'taxable_amount' => $summary['taxable_amount'],
                'vat_rate' => $summary['vat_rate'],
                'vat_total' => $summary['vat_total'],
                'withholding_rate' => $summary['withholding_rate'],
                'withholding_total' => $summary['withholding_total'],
                'shipping_fee' => $summary['shipping_fee'],
                'total_amount' => $summary['total_amount'],
                'net_payable' => $summary['net_payable'],
                'payment_terms' => $validated['payment_terms'] ?? '100% Payment on delivery / Bank Transfer',
                'payment_method' => $validated['payment_method'] ?? 'Bank Transfer',
                'bank_account_id' => $validated['bank_account_id'] ?? null,
                'reference_number' => $validated['reference_number'] ?? null,
                'prepared_by' => $validated['prepared_by'] ?? $user->name,
                'notes' => $validated['notes'] ?? null,
                'delivery_terms' => $validated['delivery_terms'] ?? null,
                'signature_stamp_config' => $validated['signature_stamp_config'] ?? null,
            ]);

            foreach ($calculation['items'] as $itemData) {
                $invoice->items()->create(array_merge($itemData, [
                    'tenant_id' => $tenant->id,
                ]));
            }

            return $invoice;
        });

        AuditLog::record(
            action: 'proforma_invoice_created',
            entityType: 'ProformaInvoice',
            entityId: $proforma->id,
            newValues: [
                'proforma_number' => $proforma->proforma_number,
                'customer_name' => $proforma->customer_name,
                'total_amount' => $proforma->total_amount,
                'net_payable' => $proforma->net_payable,
            ]
        );

        $proforma->load(['customer', 'creator', 'bankAccount', 'items']);

        return response()->json([
            'success' => true,
            'message' => 'Proforma invoice created successfully.',
            'data' => $proforma,
        ], 201);
    }

    /**
     * Display the specified proforma invoice.
     */
    public function show(string $id): JsonResponse
    {
        $proforma = ProformaInvoice::with([
            'customer',
            'creator',
            'bankAccount',
            'items.product',
            'items.variant',
            'tenant',
        ])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $proforma,
        ]);
    }

    /**
     * Update the specified proforma invoice.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $proforma = ProformaInvoice::findOrFail($id);

        $validated = $request->validate([
            'customer_name' => ['required', 'string', 'max:255'],
            'customer_id' => ['nullable', 'uuid', 'exists:contacts,id'],
            'customer_phone' => ['nullable', 'string', 'max:50'],
            'customer_email' => ['nullable', 'email', 'max:255'],
            'customer_address' => ['nullable', 'string', 'max:500'],
            'customer_tin' => ['nullable', 'string', 'max:50'],
            'issue_date' => ['required', 'date'],
            'valid_until' => ['nullable', 'date', 'after_or_equal:issue_date'],
            'currency' => ['nullable', 'string', 'max:10'],
            'status' => ['nullable', 'string', Rule::in(['draft', 'sent', 'accepted', 'expired', 'converted_to_sale'])],
            'vat_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'withholding_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'shipping_fee' => ['nullable', 'numeric', 'min:0'],
            'payment_terms' => ['nullable', 'string', 'max:255'],
            'payment_method' => ['nullable', 'string', 'max:100'],
            'bank_account_id' => ['nullable', 'uuid', 'exists:financial_accounts,id'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'prepared_by' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:3000'],
            'delivery_terms' => ['nullable', 'string', 'max:1000'],
            'signature_stamp_config' => ['nullable', 'array'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.description' => ['required', 'string', 'max:500'],
            'items.*.product_id' => ['nullable', 'uuid', 'exists:products,id'],
            'items.*.variant_id' => ['nullable', 'uuid', 'exists:product_variants,id'],
            'items.*.sku' => ['nullable', 'string', 'max:100'],
            'items.*.unit_of_measure' => ['nullable', 'string', 'max:30'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.01'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.discount_type' => ['nullable', 'string', Rule::in(['percentage', 'fixed'])],
            'items.*.discount_rate' => ['nullable', 'numeric', 'min:0'],
            'items.*.tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        $calculation = $this->calculationService->calculate($validated['items'], [
            'vat_rate' => $validated['vat_rate'] ?? $proforma->vat_rate,
            'withholding_rate' => $validated['withholding_rate'] ?? $proforma->withholding_rate,
            'shipping_fee' => $validated['shipping_fee'] ?? $proforma->shipping_fee,
        ]);

        DB::transaction(function () use ($proforma, $validated, $calculation) {
            $summary = $calculation['summary'];

            $proforma->update([
                'customer_id' => $validated['customer_id'] ?? null,
                'customer_name' => $validated['customer_name'],
                'customer_phone' => $validated['customer_phone'] ?? null,
                'customer_email' => $validated['customer_email'] ?? null,
                'customer_address' => $validated['customer_address'] ?? null,
                'customer_tin' => $validated['customer_tin'] ?? null,
                'issue_date' => $validated['issue_date'],
                'valid_until' => $validated['valid_until'] ?? null,
                'currency' => $validated['currency'] ?? $proforma->currency,
                'status' => $validated['status'] ?? $proforma->status,
                'subtotal' => $summary['subtotal'],
                'discount_total' => $summary['discount_total'],
                'taxable_amount' => $summary['taxable_amount'],
                'vat_rate' => $summary['vat_rate'],
                'vat_total' => $summary['vat_total'],
                'withholding_rate' => $summary['withholding_rate'],
                'withholding_total' => $summary['withholding_total'],
                'shipping_fee' => $summary['shipping_fee'],
                'total_amount' => $summary['total_amount'],
                'net_payable' => $summary['net_payable'],
                'payment_terms' => $validated['payment_terms'] ?? $proforma->payment_terms,
                'payment_method' => $validated['payment_method'] ?? $proforma->payment_method,
                'bank_account_id' => $validated['bank_account_id'] ?? $proforma->bank_account_id,
                'reference_number' => $validated['reference_number'] ?? $proforma->reference_number,
                'prepared_by' => $validated['prepared_by'] ?? $proforma->prepared_by,
                'notes' => $validated['notes'] ?? $proforma->notes,
                'delivery_terms' => $validated['delivery_terms'] ?? $proforma->delivery_terms,
                'signature_stamp_config' => array_key_exists('signature_stamp_config', $validated)
                    ? $validated['signature_stamp_config']
                    : $proforma->signature_stamp_config,
            ]);

            // Replace items cleanly
            $proforma->items()->delete();
            foreach ($calculation['items'] as $itemData) {
                $proforma->items()->create(array_merge($itemData, [
                    'tenant_id' => $proforma->tenant_id,
                ]));
            }
        });

        AuditLog::record(
            action: 'proforma_invoice_updated',
            entityType: 'ProformaInvoice',
            entityId: $proforma->id,
            newValues: [
                'proforma_number' => $proforma->proforma_number,
                'total_amount' => $proforma->total_amount,
                'status' => $proforma->status,
            ]
        );

        $proforma->load(['customer', 'creator', 'bankAccount', 'items']);

        return response()->json([
            'success' => true,
            'message' => 'Proforma invoice updated successfully.',
            'data' => $proforma,
        ]);
    }

    /**
     * Delete the specified proforma invoice.
     */
    public function destroy(string $id): JsonResponse
    {
        $proforma = ProformaInvoice::findOrFail($id);
        $number = $proforma->proforma_number;

        $proforma->delete();

        AuditLog::record(
            action: 'proforma_invoice_deleted',
            entityType: 'ProformaInvoice',
            entityId: $id,
            newValues: ['proforma_number' => $number]
        );

        return response()->json([
            'success' => true,
            'message' => "Proforma invoice {$number} deleted successfully.",
        ]);
    }

    /**
     * Duplicate a proforma invoice as a new draft.
     */
    public function duplicate(string $id): JsonResponse
    {
        /** @var User $user */
        $user = auth()->user();
        /** @var Tenant $tenant */
        $tenant = $user->tenant;

        $source = ProformaInvoice::with('items')->findOrFail($id);

        $newNumber = ProformaInvoice::generateProformaNumber($tenant->id);

        $clone = DB::transaction(function () use ($source, $tenant, $user, $newNumber) {
            $invoice = ProformaInvoice::create([
                'tenant_id' => $tenant->id,
                'proforma_number' => $newNumber,
                'created_by_user_id' => $user->id,
                'customer_id' => $source->customer_id,
                'customer_name' => $source->customer_name,
                'customer_phone' => $source->customer_phone,
                'customer_email' => $source->customer_email,
                'customer_address' => $source->customer_address,
                'customer_tin' => $source->customer_tin,
                'issue_date' => now()->format('Y-m-d'),
                'valid_until' => now()->addDays(14)->format('Y-m-d'),
                'currency' => $source->currency,
                'status' => 'draft',
                'subtotal' => $source->subtotal,
                'discount_total' => $source->discount_total,
                'taxable_amount' => $source->taxable_amount,
                'vat_rate' => $source->vat_rate,
                'vat_total' => $source->vat_total,
                'withholding_rate' => $source->withholding_rate,
                'withholding_total' => $source->withholding_total,
                'shipping_fee' => $source->shipping_fee,
                'total_amount' => $source->total_amount,
                'net_payable' => $source->net_payable,
                'payment_terms' => $source->payment_terms,
                'payment_method' => $source->payment_method,
                'bank_account_id' => $source->bank_account_id,
                'reference_number' => $source->reference_number ? "Copy of {$source->reference_number}" : null,
                'prepared_by' => $user->name,
                'notes' => $source->notes,
                'delivery_terms' => $source->delivery_terms,
                'signature_stamp_config' => $source->signature_stamp_config,
            ]);

            foreach ($source->items as $item) {
                $invoice->items()->create([
                    'tenant_id' => $tenant->id,
                    'item_number' => $item->item_number,
                    'product_id' => $item->product_id,
                    'variant_id' => $item->variant_id,
                    'description' => $item->description,
                    'sku' => $item->sku,
                    'unit_of_measure' => $item->unit_of_measure,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->unit_price,
                    'discount_type' => $item->discount_type,
                    'discount_rate' => $item->discount_rate,
                    'discount_amount' => $item->discount_amount,
                    'tax_rate' => $item->tax_rate,
                    'taxable_amount' => $item->taxable_amount,
                    'tax_amount' => $item->tax_amount,
                    'line_total' => $item->line_total,
                ]);
            }

            return $invoice;
        });

        $clone->load(['customer', 'creator', 'bankAccount', 'items']);

        return response()->json([
            'success' => true,
            'message' => "Proforma cloned as {$newNumber}.",
            'data' => $clone,
        ], 201);
    }

    /**
     * Update status of proforma invoice (draft, sent, accepted, expired, converted_to_sale).
     */
    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'string', Rule::in(['draft', 'sent', 'accepted', 'expired', 'converted_to_sale'])],
        ]);

        $proforma = ProformaInvoice::findOrFail($id);
        $oldStatus = $proforma->status;
        $proforma->update(['status' => $validated['status']]);

        AuditLog::record(
            action: 'proforma_status_changed',
            entityType: 'ProformaInvoice',
            entityId: $proforma->id,
            newValues: ['old_status' => $oldStatus, 'new_status' => $validated['status']]
        );

        return response()->json([
            'success' => true,
            'message' => "Status changed from {$oldStatus} to {$validated['status']}.",
            'data' => $proforma,
        ]);
    }

    /**
     * Update interactive signature and stamp placement configurations.
     */
    public function updateSignatureStampConfig(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'signature_stamp_config' => ['required', 'array'],
        ]);

        $proforma = ProformaInvoice::findOrFail($id);
        $proforma->update(['signature_stamp_config' => $validated['signature_stamp_config']]);

        return response()->json([
            'success' => true,
            'message' => 'Signature and stamp layout updated.',
            'data' => $proforma,
        ]);
    }

    /**
     * Upload an image asset (signature or stamp) converted to a resilient data URI.
     */
    public function uploadAsset(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'image', 'mimes:jpeg,png,jpg,webp,svg', 'max:4096'],
            'type' => ['nullable', 'string', Rule::in(['signature', 'stamp', 'general'])],
        ]);

        $dataUri = Tenant::convertUploadedFileToDataUri($request->file('file'));

        return response()->json([
            'success' => true,
            'message' => 'Asset uploaded successfully.',
            'data' => [
                'url' => $dataUri,
                'type' => $request->input('type', 'general'),
            ],
        ]);
    }

    /**
     * Generate and download or stream executive PDF.
     */
    public function downloadPdf(Request $request, string $id)
    {
        $proforma = ProformaInvoice::with([
            'items',
            'customer',
            'creator',
            'bankAccount',
            'tenant',
        ])->findOrFail($id);

        $forceDownload = $request->boolean('download', false);

        return $this->pdfService->generateProformaPdf($proforma, $forceDownload);
    }
}
