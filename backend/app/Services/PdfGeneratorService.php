<?php

namespace App\Services;

use App\Actions\GenerateBusinessReportAction;
use App\Actions\GeneratePartnerStatementAction;
use App\Models\Contact;
use App\Models\ProformaInvoice;
use App\Models\SalesOrder;
use App\Models\Tenant;
use Carbon\Carbon;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
use Spatie\LaravelPdf\Enums\Format;
use Spatie\LaravelPdf\Facades\Pdf;

class PdfGeneratorService
{
    public function __construct(
        protected GeneratePartnerStatementAction $statementAction,
        protected GenerateBusinessReportAction $reportAction
    ) {}

    /**
     * Resample and compress binary image data to crisp print dimensions while saving CPU and payload size.
     */
    public static function compressImage(string $binaryData, ?string $mime = 'image/png', int $maxDim = 400): string
    {
        $mime = $mime ?: 'image/png';
        if (strlen($binaryData) < 60 * 1024 || ! extension_loaded('gd')) {
            return "data:{$mime};base64," . base64_encode($binaryData);
        }

        try {
            $src = @imagecreatefromstring($binaryData);
            if (! $src) {
                return "data:{$mime};base64," . base64_encode($binaryData);
            }

            $w = imagesx($src);
            $h = imagesy($src);

            if ($w <= $maxDim && $h <= $maxDim) {
                return "data:{$mime};base64," . base64_encode($binaryData);
            }

            $ratio = min($maxDim / $w, $maxDim / $h, 1.0);
            $newW = max(1, (int) round($w * $ratio));
            $newH = max(1, (int) round($h * $ratio));

            $dst = imagecreatetruecolor($newW, $newH);
            imagealphablending($dst, false);
            imagesavealpha($dst, true);
            $transparent = imagecolorallocatealpha($dst, 255, 255, 255, 127);
            imagefilledrectangle($dst, 0, 0, $newW, $newH, $transparent);

            imagecopyresampled($dst, $src, 0, 0, 0, 0, $newW, $newH, $w, $h);

            ob_start();
            imagepng($dst, null, 7);
            $compressed = ob_get_clean();

            return 'data:image/png;base64,' . base64_encode($compressed);
        } catch (\Throwable) {
            return "data:{$mime};base64," . base64_encode($binaryData);
        }
    }

    /**
     * Convert local storage image URLs to base64 so Chrome renders them with zero network latency.
     */
    public static function resolveImageBase64(?string $url): ?string
    {
        if (empty($url)) {
            return null;
        }

        if (str_starts_with($url, 'data:image')) {
            if (strlen($url) > 100 * 1024 && str_contains($url, ';base64,')) {
                [$header, $base64Data] = explode(';base64,', $url, 2);
                $decoded = base64_decode($base64Data);
                if ($decoded !== false) {
                    $mime = str_replace('data:', '', $header);

                    return self::compressImage($decoded, $mime);
                }
            }

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

            return self::compressImage(file_get_contents($publicFile), $mime);
        }

        // Check storage symlink: storage/... -> storage/app/public/...
        if (str_starts_with($relativePath, 'storage/')) {
            $subPath = substr($relativePath, 8);
            $storageFile = storage_path('app/public/' . $subPath);
            if (file_exists($storageFile) && is_file($storageFile)) {
                $mime = mime_content_type($storageFile) ?: 'image/png';

                return self::compressImage(file_get_contents($storageFile), $mime);
            }
        }

        return null;
    }

    /**
     * Render an HTML string into binary PDF using direct Headless Chromium CLI,
     * with fallback to Spatie LaravelPdf.
     */
    public function renderHtmlToPdf(string $html): string
    {
        $chromeBinary = config('laravel-pdf.chrome.chrome_binary')
            ?: (PHP_OS_FAMILY === 'Darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/chromium-browser');

        // 1. Direct Headless Chromium CLI (--print-to-pdf)
        // This executes Chromium synchronously without WebSockets or DevTools Protocol,
        // making it 100% resilient to WebSocket disconnection issues on Alpine Docker.
        if (! empty($chromeBinary) && (file_exists($chromeBinary) || is_executable($chromeBinary))) {
            try {
                $uniqueId = (string) Str::uuid();
                $tempDir = rtrim(sys_get_temp_dir(), '/');
                $tempHtmlPath = "{$tempDir}/doc_{$uniqueId}.html";
                $tempPdfPath = "{$tempDir}/doc_{$uniqueId}.pdf";
                $tempProfileDir = "{$tempDir}/chrome_profile_{$uniqueId}";
                @mkdir($tempProfileDir, 0777, true);

                file_put_contents($tempHtmlPath, $html);

                $envPrefix = 'HOME=/tmp XDG_CONFIG_HOME=/tmp/.chromium-config XDG_CACHE_HOME=/tmp/.chromium-cache TMPDIR=/tmp';
                $cmd = sprintf(
                    '%s %s --headless --no-sandbox --disable-setuid-sandbox --disable-gpu --disable-dev-shm-usage --disable-software-rasterizer --disable-crash-reporter --no-first-run --no-default-browser-check --font-render-hinting=none --user-data-dir=%s --no-pdf-header-footer --print-to-pdf=%s file://%s 2>&1',
                    $envPrefix,
                    escapeshellarg($chromeBinary),
                    escapeshellarg($tempProfileDir),
                    escapeshellarg($tempPdfPath),
                    escapeshellarg($tempHtmlPath)
                );

                $output = [];
                $exitCode = 0;
                exec($cmd, $output, $exitCode);

                if (file_exists($tempPdfPath) && filesize($tempPdfPath) > 1000) {
                    $pdfContent = file_get_contents($tempPdfPath);
                    @unlink($tempHtmlPath);
                    @unlink($tempPdfPath);
                    exec('rm -rf ' . escapeshellarg($tempProfileDir));

                    return $pdfContent;
                }

                @unlink($tempHtmlPath);
                @unlink($tempPdfPath);
                exec('rm -rf ' . escapeshellarg($tempProfileDir));
                \Log::warning('Direct Chromium CLI returned empty or failed, trying Dompdf fallback', [
                    'exit_code' => $exitCode,
                    'output' => implode("\n", array_slice($output, -10)),
                ]);
            } catch (\Throwable $cliException) {
                \Log::warning('Direct Chromium CLI exception, trying Dompdf fallback: ' . $cliException->getMessage());
            }
        }

        // 2. Pure-PHP Dompdf Engine (100% resilient, runs directly inside PHP-FPM memory)
        try {
            $options = new \Dompdf\Options();
            $options->set('isHtml5ParserEnabled', true);
            $options->set('isRemoteEnabled', false);
            $options->set('defaultFont', 'Helvetica');
            $options->set('dpi', 96);

            $dompdf = new \Dompdf\Dompdf($options);
            $dompdf->loadHtml($html, 'UTF-8');
            $dompdf->setPaper('A4', 'portrait');
            $dompdf->render();

            $output = $dompdf->output();
            if (! empty($output) && strlen($output) > 1000) {
                return $output;
            }
        } catch (\Throwable $dompdfException) {
            \Log::error('Dompdf fallback error: ' . $dompdfException->getMessage());
        }

        // 3. Last-resort fallback to Spatie LaravelPdf if available
        try {
            $pdf = Pdf::html($html)->format(Format::A4);
            $base64 = $pdf->base64();
            if (! empty($base64)) {
                return base64_decode($base64);
            }
        } catch (\Throwable $spatieException) {
            \Log::error('Spatie fallback error: ' . $spatieException->getMessage());
        }

        throw new \RuntimeException('All PDF rendering engines failed to produce output.');

        throw new \RuntimeException('Failed to generate PDF through both Chromium Direct CLI and Spatie engines.');
    }

    /**
     * Create a standard PDF HTTP response supporting both direct return and ->toResponse() chaining.
     */
    public function renderToPdfResponse(
        string $view,
        array $viewData,
        string $filename,
        bool $forceDownload = true
    ): \Symfony\Component\HttpFoundation\Response {
        $html = view($view, $viewData)->render();
        $pdfBinary = $this->renderHtmlToPdf($html);

        $disposition = $forceDownload ? 'attachment' : 'inline';

        return new class($pdfBinary, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => "{$disposition}; filename=\"{$filename}\"",
            'Content-Length' => strlen($pdfBinary),
            'Cache-Control' => 'private, no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0',
            'X-PDF-Engine' => 'Chromium-Direct-Vector',
        ]) extends \Illuminate\Http\Response {
            public function toResponse($request): \Symfony\Component\HttpFoundation\Response
            {
                return $this;
            }
        };
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
    ): \Symfony\Component\HttpFoundation\Response {
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

        return $this->renderToPdfResponse('pdf.vendor-statement', $data, $filename, $forceDownload);
    }

    /**
     * Generate an executive Sales Invoice & Official Customer Receipt PDF.
     */
    public function generateSalesInvoice(
        SalesOrder $order,
        bool $forceDownload = true
    ): \Symfony\Component\HttpFoundation\Response {
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

        return $this->renderToPdfResponse('pdf.sales-invoice', [
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
        ], $filename, $forceDownload);
    }

    /**
     * Generate an executive Proforma Invoice PDF with corporate branding, tax calculations, and optional stamp/signature.
     */
    public function generateProformaPdf(
        ProformaInvoice $proforma,
        bool $forceDownload = true
    ): \Symfony\Component\HttpFoundation\Response {
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

        return $this->renderToPdfResponse('pdf.proforma-invoice', [
            'proforma' => $proforma,
            'business' => $business,
            'signatureBase64' => $signatureBase64,
            'stampBase64' => $stampBase64,
            'stampConfig' => $stampConfig,
            'filename' => $filename,
        ], $filename, $forceDownload);
    }

    /**
     * Generate an executive, audit-ready Financial Performance & Business Statement PDF.
     */
    public function generateBusinessReportPdf(
        Tenant $tenant,
        Carbon $from,
        Carbon $to,
        bool $forceDownload = true
    ): \Symfony\Component\HttpFoundation\Response {
        $reportData = $this->reportAction->execute($from, $to);
        $summary = $reportData['summary'];

        $tenantSettings = $tenant->settings ?? [];
        $ownerUser = $tenant->users()->where('role', 'owner')->first();

        $addressParts = array_filter([
            $tenantSettings['address'] ?? null,
            $tenantSettings['city'] ?? null,
        ]);
        $branch = ! empty($addressParts) ? implode(', ', $addressParts) : ($tenant->business_type ? ucfirst($tenant->business_type) : 'Addis Ababa');

        $businessName = ! empty($tenant->name) ? $tenant->name : 'HabeshaBiz Electronics';
        $businessPhone = ! empty($tenant->phone) ? $tenant->phone : '+251 91 123 4567';
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

        // Resolve signature & stamp if configured
        $prefs = $tenantSettings['signature_stamp_preferences'] ?? [];
        $autoEmbed = $prefs['auto_embed_report'] ?? true;
        $sigUrl = $autoEmbed ? ($tenantSettings['default_signature_url'] ?? null) : null;
        $stmpUrl = $autoEmbed ? ($tenantSettings['default_stamp_url'] ?? null) : null;

        $signatureBase64 = self::resolveImageBase64($sigUrl);
        $stampBase64 = self::resolveImageBase64($stmpUrl);

        $sanitizedBusiness = Str::slug($businessName, '_');
        $rangeStr = $from->format('Y_m_d') . '_to_' . $to->format('Y_m_d');
        $filename = "Financial_Statement_{$sanitizedBusiness}_{$rangeStr}.pdf";

        $cogs = max(0, ($summary['revenue'] ?? 0) - ($summary['gross_profit'] ?? 0));
        $grossMargin = ($summary['revenue'] ?? 0) > 0 ? round((($summary['gross_profit'] ?? 0) / $summary['revenue']) * 100, 1) : 0;
        $netMargin = ($summary['revenue'] ?? 0) > 0 ? round((($summary['net_profit'] ?? 0) / $summary['revenue']) * 100, 1) : 0;

        $staffPerformance = $reportData['staff_performance'] ?? [];
        $staffTotals = [
            'orders' => array_sum(array_column($staffPerformance, 'orders')),
            'units' => array_sum(array_column($staffPerformance, 'units')),
            'revenue' => array_sum(array_column($staffPerformance, 'revenue')),
            'profit' => array_sum(array_column($staffPerformance, 'profit')),
        ];

        $vendorList = $reportData['vendor_activity']['vendors'] ?? [];
        $vendorTotals = [
            'received' => array_sum(array_column($vendorList, 'received_units')),
            'sold' => array_sum(array_column($vendorList, 'units_sold')),
            'revenue' => array_sum(array_column($vendorList, 'revenue')),
            'returned' => array_sum(array_column($vendorList, 'returned_units')),
        ];

        $footerHtml = '<div style="width: 100%; font-size: 7.5pt; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; padding: 0 12mm; font-family: -apple-system, BlinkMacSystemFont, Roboto, sans-serif;">'
            . '<span>' . e($business['name']) . ' · Executive Financial Statement & Business Audit</span>'
            . '<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>'
            . '</div>';

        return $this->renderToPdfResponse('pdf.financial-report', [
            'report' => $reportData,
            'summary' => $summary,
            'business' => $business,
            'cogs' => $cogs,
            'grossMargin' => $grossMargin,
            'netMargin' => $netMargin,
            'staffTotals' => $staffTotals,
            'vendorTotals' => $vendorTotals,
            'signatureBase64' => $signatureBase64,
            'stampBase64' => $stampBase64,
            'from' => $from,
            'to' => $to,
            'issuedDate' => now()->format('d/m/Y'),
            'filename' => $filename,
        ], $filename, $forceDownload);
    }
}
