<?php

namespace App\Services;

use App\Actions\GeneratePartnerStatementAction;
use App\Models\Contact;
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
}
