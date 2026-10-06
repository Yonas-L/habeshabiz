<?php

namespace App\Support;

class DeviceDetector
{
    /**
     * Parse raw User-Agent header string into structured device metadata.
     *
     * @param string|null $userAgent
     * @return array{type: string, platform: string, browser: string, label: string, raw: ?string}
     */
    public static function parse(?string $userAgent): array
    {
        if (empty($userAgent)) {
            return [
                'type' => 'desktop',
                'platform' => 'Web Browser',
                'browser' => 'Unknown',
                'label' => 'Web Browser',
                'raw' => null,
            ];
        }

        $ua = $userAgent;
        $platform = 'Desktop';
        $type = 'desktop';

        // Detect OS / Platform
        if (preg_match('/iPhone/i', $ua)) {
            $platform = 'iPhone (iOS)';
            $type = 'mobile';
        } elseif (preg_match('/iPad/i', $ua)) {
            $platform = 'iPad (iPadOS)';
            $type = 'tablet';
        } elseif (preg_match('/Android/i', $ua)) {
            if (preg_match('/Mobile/i', $ua)) {
                $platform = 'Android Phone';
                $type = 'mobile';
            } else {
                $platform = 'Android Tablet';
                $type = 'tablet';
            }
        } elseif (preg_match('/Macintosh|Mac OS X/i', $ua)) {
            $platform = 'Mac (macOS)';
            $type = 'desktop';
        } elseif (preg_match('/Windows NT/i', $ua)) {
            $platform = 'Windows PC';
            $type = 'desktop';
        } elseif (preg_match('/Linux/i', $ua)) {
            $platform = 'Linux';
            $type = 'desktop';
        }

        // Detect Browser
        $browser = 'Browser';
        if (preg_match('/Edg/i', $ua)) {
            $browser = 'Edge';
        } elseif (preg_match('/Chrome/i', $ua) && !preg_match('/Edg/i', $ua)) {
            $browser = 'Chrome';
        } elseif (preg_match('/Safari/i', $ua) && !preg_match('/Chrome/i', $ua)) {
            $browser = 'Safari';
        } elseif (preg_match('/Firefox/i', $ua)) {
            $browser = 'Firefox';
        } elseif (preg_match('/Opera|OPR/i', $ua)) {
            $browser = 'Opera';
        }

        return [
            'type' => $type,
            'platform' => $platform,
            'browser' => $browser,
            'label' => "{$platform} · {$browser}",
            'raw' => substr($ua, 0, 255),
        ];
    }
}
