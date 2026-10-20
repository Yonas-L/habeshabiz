<?php

namespace App\Services;

use App\Actions\GeneratePartnerStatementAction;
use App\Models\Contact;
use App\Models\ProformaInvoice;
use App\Models\SalesOrder;
use App\Models\Tenant;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
use Spatie\LaravelPdf\Enums\Format;
use Spatie\LaravelPdf\Facades\Pdf;

class PdfGeneratorService
{
    public function __construct(
        protected GeneratePartnerStatementAction $statementAction
    ) {}

    /**
     * Convert local storage image URLs to base64 so Chrome renders them with zero network latency.
     */
    public static function resolveImageBase64(?string $url): ?string
    {
        if (empty($url)) {
            return null;
        }

        if (str_starts_with($url, 'data:image')) {
            return $url;
        }

        $parsedPath = parse_url($url, PHP_URL_PATH);
        if (! $parsedPath) {
            return null;
        }

        $relativePath = ltrim($parsedPath, '/');

        // Check if directly in public/
        $publicFile = public_path($relativePath);
        if (file_exists($publicFile) && is_file($publicFile)) {
            $mime = mime_content_type($publicFile) ?: 'image/png';
            $data = base64_encode(file_get_contents($publicFile));

            return "data:{$mime};base64,{$data}";
        }

        // Check storage symlink: storage/... -> storage/app/public/...
        if (str_starts_with($relativePath, 'storage/')) {
            $subPath = substr($relativePath, 8);
            $storageFile = storage_path('app/public/' . $subPath);
            if (file_exists($storageFile) && is_file($storageFile)) {
                $mime = mime_content_type($storageFile) ?: 'image/png';
                $data = base64_encode(file_get_contents($storageFile));

                return "data:{$mime};base64,{$data}";
            }
        }

        return null;
    }

    /**
     * Generate a crisp, vendor-facing Account Statement PDF.
     */
    public function generateVendorStatement(
        Contact $contact,
        ?string $startDate = null,
        ?string $endDate = null,
        array $selectedAccountIds = [],
        bool $forceDownload = true
    ): \Spatie\LaravelPdf\PdfBuilder {
        $data = $this->statementAction->execute($contact, $startDate, $endDate);

        // Resolve logo to base64
        $logoUrl = $data['business']['logo_url'] ?? null;
        $data['business']['logo_base64'] = self::resolveImageBase64($logoUrl);

        // Filter remittance accounts if requested
        $allAccounts = $data['business']['bank_accounts'] ?? [];
        if (! empty($selectedAccountIds)) {
            $data['selectedAccounts'] = array_values(array_filter(
                $allAccounts,
                fn ($acc) => in_array($acc['id'], $selectedAccountIds)
            ));
        } else {
            $data['selectedAccounts'] = $allAccounts;
        }

        $sanitizedContact = Str::slug($contact->name ?: 'Partner', '_');
        $sanitizedRange = Str::slug($data['range']['formatted_range'] ?? 'Statement', '_');
        $filename = "Statement_{$sanitizedContact}_{$sanitizedRange}.pdf";
        $data['filename'] = $filename;

        // Resolve default signature and stamp for vendor statements
        $tenant = $contact->tenant;
        if (! $tenant && ! empty($contact->tenant_id)) {
            $tenant = Tenant::find($contact->tenant_id);
        }
        $tenantSettings = $tenant?->settings ?? [];
        $prefs = $tenantSettings['signature_stamp_preferences'] ?? [];
        $autoEmbed = $prefs['auto_embed_vendor_statement'] ?? true;

        $sigUrl = $autoEmbed ? ($tenantSettings['default_signature_url'] ?? null) : null;
        $stmpUrl = $autoEmbed ? ($tenantSettings['default_stamp_url'] ?? null) : null;

        $data['signatureBase64'] = self::resolveImageBase64($sigUrl);
        $data['stampBase64'] = self::resolveImageBase64($stmpUrl);
        $data['stampConfig'] = [
            'show_signature' => ! empty($data['signatureBase64']),
            'show_stamp' => ! empty($data['stampBase64']),
            'stamp_position' => $prefs['default_stamp_size'] ?? ['x' => 74, 'y' => 84, 'width' => 22, 'height' => 18],
            'signature_position' => $prefs['default_signature_size'] ?? ['x' => 78, 'y' => 89, 'width' => 20, 'height' => 10],
        ];

        $footerHtml = '<div style="width: 100%; font-size: 7.5pt; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; padding: 0 12mm; font-family: -apple-system, BlinkMacSystemFont, Roboto, sans-serif;">'
            . '<span>' . e($data['business']['name']) . ' · Verified Accounting Statement</span>'
            . '<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>'
            . '</div>';

        $pdf = Pdf::view('pdf.vendor-statement', $data)
            ->format(Format::A4)
            ->margins(top: 8, right: 12, bottom: 8, left: 12, unit: 'mm')
            ->headerHtml('<span style="font-size: 1px;"></span>')
            ->footerHtml($footerHtml)
            ->name($filename);

        return $forceDownload ? $pdf->download() : $pdf->inline();
    }

    /**
     * Generate an executive Sales Invoice & Official Customer Receipt PDF.
     */
    public function generateSalesInvoice(
        SalesOrder $order,
        bool $forceDownload = true
    ): \Spatie\LaravelPdf\PdfBuilder {
        $order->loadMissing([
            'customer',
            'vendor',
            'salesperson',
            'financialAccount',
            'exchangeUnit.variant.product',
            'items.variant.product',
            'items.inventoryUnit.variant.product',
            'items.inventoryUnit.swappedFromUnit.variant.product',
            'items.inventoryUnit.swappedReplacementUnit.variant.product',
            'items.inventoryUnit.swappedSalesOrder',
            'items.vendorContact',
        ]);

        $tenant = $order->tenant;
        if (! $tenant && ! empty($order->tenant_id)) {
            $tenant = Tenant::find($order->tenant_id);
        }
        $tenantSettings = $tenant?->settings ?? [];
        $ownerUser = $tenant?->users()->where('role', 'owner')->first();

        $addressParts = array_filter([
            $tenantSettings['address'] ?? null,
            $tenantSettings['city'] ?? null,
        ]);
        $branch = ! empty($addressParts) ? implode(', ', $addressParts) : ($tenant?->business_type ? ucfirst($tenant->business_type) : 'Addis Ababa');

        $businessName = ! empty($tenant?->name) ? $tenant->name : 'HabeshaBiz Electronics';
        $businessPhone = ! empty($tenant?->phone) ? $tenant->phone : '+251 91 123 4567';
        $businessEmail = ! empty($ownerUser?->email) ? $ownerUser->email : 'sales@habeshabiz.et';
        $businessLogo = $tenantSettings['logo_url'] ?? null;

        $business = [
            'name' => $businessName,
            'branch' => $branch,
            'phone' => $businessPhone,
            'email' => $businessEmail,
            'logo_url' => $businessLogo,
            'logo_base64' => self::resolveImageBase64($businessLogo),
            'tin_number' => $tenantSettings['tin_number'] ?? null,
            'footer_note' => $tenantSettings['footer_note'] ?? null,
        ];

        $grossAmount = (float) $order->total_amount;
        $discountAmount = (float) ($order->discount_amount ?? 0);
        $writeOffAmount = (float) ($order->write_off_amount ?? 0);
        $exchangeAllowance = (float) ($order->exchange_allowance ?? 0);
        $netPayable = max(0, $grossAmount - $discountAmount - $exchangeAllowance);
        $paidAmount = (float) ($order->paid_amount ?? 0);
        $remainingDebt = max(0, $netPayable - $paidAmount - $writeOffAmount);
        $settledSaleValue = max(0, $netPayable - $writeOffAmount);

        $isRefunded = $order->payment_status === 'refunded' ||
            ($order->items->isNotEmpty() && $order->items->every(fn ($i) => in_array($i->inventoryUnit?->status, ['returned', 'returned_to_vendor'])));
        $isOffset = $order->payment_method === 'debt_offset';
        $customerRoles = (array) ($order->customer?->roles ?? []);
        $isB2B = $isOffset || ! empty(array_intersect(['peer_vendor', 'vendor', 'supplier', 'partner'], $customerRoles));
        $isPaid = ! $isRefunded && ($order->payment_status === 'paid' || $remainingDebt == 0);

        $filename = "Invoice_{$order->order_number}.pdf";

        $sanitizedNotes = null;
        if (! empty($order->notes)) {
            $raw = preg_replace('/\[unit_id:[a-zA-Z0-9_-]+\]/i', '', $order->notes);
            $lines = explode("\n", (string) $raw);
            $cleanLines = [];
            foreach ($lines as $line) {
                $segments = array_filter(array_map('trim', explode('|', $line)));
                if (! empty($segments)) {
                    $cleanLines[] = implode(' · ', array_unique($segments));
                }
            }
            $sanitizedNotes = ! empty($cleanLines) ? implode("\n", $cleanLines) : null;
        }

        // Resolve signature & stamp config
        $prefs = $tenantSettings['signature_stamp_preferences'] ?? [];
        $autoEmbed = $prefs['auto_embed_sales_invoice'] ?? true;
        $orderConfig = $order->signature_stamp_config ?? [];

        $signatureUrl = $orderConfig['signature_url'] ?? ($autoEmbed ? ($tenantSettings['default_signature_url'] ?? null) : null);
        $stampUrl = $orderConfig['stamp_url'] ?? ($autoEmbed ? ($tenantSettings['default_stamp_url'] ?? null) : null);

        $signatureBase64 = self::resolveImageBase64($signatureUrl);
        $stampBase64 = self::resolveImageBase64($stampUrl);
        $stampConfig = array_merge([
            'show_signature' => ! empty($signatureBase64),
            'show_stamp' => ! empty($stampBase64),
            'stamp_position' => $prefs['default_stamp_size'] ?? ['x' => 74, 'y' => 84, 'width' => 22, 'height' => 18],
            'signature_position' => $prefs['default_signature_size'] ?? ['x' => 78, 'y' => 89, 'width' => 20, 'height' => 10],
        ], $orderConfig);

        $footerHtml = '<div style="width: 100%; font-size: 7.5pt; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; padding: 0 12mm; font-family: -apple-system, BlinkMacSystemFont, Roboto, sans-serif;">'
            . '<span>' . e($business['name']) . ' · Official Sales Invoice & Receipt</span>'
            . '<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>'
            . '</div>';

        $pdf = Pdf::view('pdf.sales-invoice', [
            'order' => $order,
            'business' => $business,
            'grossAmount' => $grossAmount,
            'discountAmount' => $discountAmount,
            'writeOffAmount' => $writeOffAmount,
            'exchangeAllowance' => $exchangeAllowance,
            'netPayable' => $netPayable,
            'paidAmount' => $paidAmount,
            'remainingDebt' => $remainingDebt,
            'settledSaleValue' => $settledSaleValue,
            'isRefunded' => $isRefunded,
            'isOffset' => $isOffset,
            'isB2B' => $isB2B,
            'isPaid' => $isPaid,
            'sanitizedNotes' => $sanitizedNotes,
            'signatureBase64' => $signatureBase64,
            'stampBase64' => $stampBase64,
            'stampConfig' => $stampConfig,
            'filename' => $filename,
        ])
            ->format(Format::A4)
            ->margins(top: 8, right: 12, bottom: 8, left: 12, unit: 'mm')
            ->headerHtml('<span style="font-size: 1px;"></span>')
            ->footerHtml($footerHtml)
            ->name($filename);

        return $forceDownload ? $pdf->download() : $pdf->inline();
    }

    /**
     * Generate an executive Proforma Invoice PDF with corporate branding, tax calculations, and optional stamp/signature.
     */
    public function generateProformaPdf(
        ProformaInvoice $proforma,
        bool $forceDownload = true
    ): \Spatie\LaravelPdf\PdfBuilder {
        $proforma->loadMissing([
            'customer',
            'creator',
            'bankAccount',
            'items.product',
            'items.variant',
        ]);

        $tenant = $proforma->tenant;
        if (! $tenant && ! empty($proforma->tenant_id)) {
            $tenant = Tenant::find($proforma->tenant_id);
        }
        $tenantSettings = $tenant?->settings ?? [];
        $ownerUser = $tenant?->users()->where('role', 'owner')->first();

        $addressParts = array_filter([
            $tenantSettings['address'] ?? null,
            $tenantSettings['city'] ?? null,
        ]);
        $branch = ! empty($addressParts) ? implode(', ', $addressParts) : ($tenant?->business_type ? ucfirst($tenant->business_type) : 'Addis Ababa');

        $businessName = ! empty($tenant?->name) ? $tenant->name : 'HabeshaBiz Electronics';
        $businessPhone = ! empty($tenant?->phone) ? $tenant->phone : '+251 91 123 4567';
        $businessEmail = ! empty($ownerUser?->email) ? $ownerUser->email : 'sales@habeshabiz.et';
        $businessLogo = $tenantSettings['logo_url'] ?? null;

        $business = [
            'name' => $businessName,
            'branch' => $branch,
            'phone' => $businessPhone,
            'email' => $businessEmail,
            'logo_url' => $businessLogo,
            'logo_base64' => self::resolveImageBase64($businessLogo),
            'tin_number' => $tenantSettings['tin_number'] ?? null,
            'vat_number' => $tenantSettings['vat_number'] ?? $tenantSettings['tin_number'] ?? null,
            'footer_note' => $tenantSettings['footer_note'] ?? null,
        ];

        // Resolving signature and stamp config
        $prefs = $tenantSettings['signature_stamp_preferences'] ?? [];
        $autoEmbed = $prefs['auto_embed_proforma'] ?? true;
        $config = $proforma->signature_stamp_config ?? [];
        $signatureUrl = $config['signature_url'] ?? ($autoEmbed ? ($tenantSettings['default_signature_url'] ?? null) : null);
        $stampUrl = $config['stamp_url'] ?? ($autoEmbed ? ($tenantSettings['default_stamp_url'] ?? null) : null);

        $signatureBase64 = self::resolveImageBase64($signatureUrl);
        $stampBase64 = self::resolveImageBase64($stampUrl);
        $stampConfig = array_merge([
            'show_signature' => ! empty($signatureBase64),
            'show_stamp' => ! empty($stampBase64),
            'stamp_position' => $prefs['default_stamp_size'] ?? ['x' => 74, 'y' => 84, 'width' => 22, 'height' => 18],
            'signature_position' => $prefs['default_signature_size'] ?? ['x' => 78, 'y' => 89, 'width' => 20, 'height' => 10],
        ], $config);

        $filename = "Proforma_{$proforma->proforma_number}.pdf";

        $footerHtml = '<div style="width: 100%; font-size: 7.5pt; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; padding: 0 12mm; font-family: -apple-system, BlinkMacSystemFont, Roboto, sans-serif;">'
            . '<span>' . e($business['name']) . ' · Proforma Invoice & Official Quotation</span>'
            . '<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>'
            . '</div>';

        $pdf = Pdf::view('pdf.proforma-invoice', [
            'proforma' => $proforma,
            'business' => $business,
            'signatureBase64' => $signatureBase64,
            'stampBase64' => $stampBase64,
            'stampConfig' => $stampConfig,
            'filename' => $filename,
        ])
            ->format(Format::A4)
            ->margins(top: 8, right: 12, bottom: 8, left: 12, unit: 'mm')
            ->headerHtml('<span style="font-size: 1px;"></span>')
            ->footerHtml($footerHtml)
            ->name($filename);

        return $forceDownload ? $pdf->download() : $pdf->inline();
    }
}
