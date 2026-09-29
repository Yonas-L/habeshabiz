<?php

namespace App\Services;

use App\Models\PlatformWaitlist;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class TelegramNotificationService
{
    public function sendMessage(string $message): void
    {
        $botToken = config('services.telegram.bot_token');
        $chatId = config('services.telegram.chat_id');

        if (empty($botToken) || empty($chatId)) {
            Log::info('Telegram notification skipped: bot_token or chat_id not configured.');

            return;
        }

        try {
            Http::timeout(5)->post("https://api.telegram.org/bot{$botToken}/sendMessage", [
                'chat_id' => $chatId,
                'text' => $message,
                'parse_mode' => 'HTML',
            ]);
        } catch (Throwable $e) {
            Log::warning('Telegram notification failed: '.$e->getMessage());
        }
    }

    public function notifyWaitlistSubmission(PlatformWaitlist $waitlist): void
    {
        $phone = $waitlist->phone ?: 'not provided';
        $business = $waitlist->business_name ?: 'not provided';
        $messageText = $waitlist->message ?: 'none';
        $time = $waitlist->created_at ? $waitlist->created_at->format('D M j, Y H:i') : now()->format('D M j, Y H:i');

        $message = "<b>📋 New Waitlist Submission</b>\n"
            ."Name: {$waitlist->name}\n"
            ."Email: {$waitlist->email}\n"
            ."Phone: {$phone}\n"
            ."Business: {$business}\n"
            ."Message: {$messageText}\n"
            ."Consent: ✅ Yes\n"
            ."Time: {$time}";

        $this->sendMessage($message);
    }

    public function notifyOptedOut(string $email, ?string $businessName = null): void
    {
        $business = $businessName ?: 'not provided';
        $time = now()->format('D M j, Y H:i');

        $message = "<b>👀 Signup Attempt (No Consent)</b>\n"
            ."Email: {$email}\n"
            ."Business: {$business}\n"
            ."Time: {$time}";

        $this->sendMessage($message);
    }
}
