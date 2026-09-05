<?php

namespace App\Services;

use App\Models\Setting;
use App\Models\Warehouse;
use Carbon\Carbon;

class OperatingHoursService
{
    public const DAY_NAMES = [
        1 => 'Senin',
        2 => 'Selasa',
        3 => 'Rabu',
        4 => 'Kamis',
        5 => 'Jumat',
        6 => 'Sabtu',
        7 => 'Minggu',
    ];

    /**
     * Resolve operating status for a specific warehouse/branch.
     */
    public function getWarehouseStatus(?Warehouse $warehouse, ?Carbon $now = null): array
    {
        $now = $now ? $now->copy() : Carbon::now(config('app.timezone', 'Asia/Jakarta'));

        if (! $warehouse) {
            return $this->getStoreDefaultStatus($now);
        }

        $isTemporarilyClosed = (bool) ($warehouse->is_temporarily_closed ?? false);
        $reopenDate = $warehouse->reopen_date ? Carbon::parse($warehouse->reopen_date) : null;
        $closureReason = trim((string) ($warehouse->closure_reason ?? ''));

        // 1. Temporary closure check
        if ($isTemporarilyClosed) {
            // Auto-reopen if reopen_date is reached or passed
            if ($reopenDate && $now->startOfDay()->gt($reopenDate->startOfDay())) {
                $isTemporarilyClosed = false;
            } else {
                $reopenFormatted = $reopenDate ? $reopenDate->translatedFormat('d M Y') : null;
                $badgeText = 'Tutup Sementara';
                if ($closureReason) {
                    $badgeText .= ' · '.$closureReason;
                } elseif ($reopenFormatted) {
                    $badgeText .= ' · Buka '.$reopenFormatted;
                }

                return [
                    'is_open' => false,
                    'status' => 'temporarily_closed',
                    'sub_status' => 'temporarily_closed',
                    'label' => 'Tutup Sementara',
                    'badge_text' => $badgeText,
                    'badge_color' => 'rose',
                    'closure_reason' => $closureReason,
                    'reopen_date' => $reopenFormatted,
                    'reopen_date_formatted' => $reopenFormatted,
                    'reopen_date_raw' => $reopenDate ? $reopenDate->format('Y-m-d') : null,
                    'schedule_info' => $closureReason ? "Tutup sementara: {$closureReason}" : 'Tutup sementara',
                ];
            }
        }

        // 2. 24 Hours check
        if ((bool) ($warehouse->is_24_hours ?? false)) {
            return [
                'is_open' => true,
                'status' => 'open',
                'sub_status' => 'open_24h',
                'is_24_hours' => true,
                'label' => 'Buka',
                'badge_text' => 'Buka 24 Jam',
                'badge_color' => 'emerald',
                'closure_reason' => null,
                'reopen_date' => null,
                'reopen_date_formatted' => null,
                'schedule_info' => 'Buka 24 Jam Setiap Hari',
            ];
        }

        // 3. Operating Days check
        $rawOperatingDays = $warehouse->operating_days;
        $operatingDays = is_array($rawOperatingDays) && ! empty($rawOperatingDays)
            ? array_map('intval', $rawOperatingDays)
            : [1, 2, 3, 4, 5, 6, 7];

        $todayDayOfWeek = (int) $now->dayOfWeekIso; // 1 = Mon, 7 = Sun
        $openTime = $warehouse->open_time ?: '08:00';
        $closeTime = $warehouse->close_time ?: '21:00';

        if (! in_array($todayDayOfWeek, $operatingDays, true)) {
            // Find next operating day
            $nextDayName = '';
            for ($i = 1; $i <= 7; $i++) {
                $nextDay = ($todayDayOfWeek + $i - 1) % 7 + 1;
                if (in_array($nextDay, $operatingDays, true)) {
                    $nextDayName = self::DAY_NAMES[$nextDay] ?? '';
                    break;
                }
            }

            $badgeText = $nextDayName ? "Libur Hari Ini · Buka {$nextDayName}" : 'Libur Hari Ini';

            return [
                'is_open' => false,
                'status' => 'closed',
                'sub_status' => 'closed_day_off',
                'label' => 'Libur',
                'badge_text' => $badgeText,
                'badge_color' => 'rose',
                'closure_reason' => 'Libur hari ini',
                'reopen_date' => null,
                'reopen_date_formatted' => null,
                'open_time' => $openTime,
                'close_time' => $closeTime,
                'schedule_info' => "Jam buka normal: {$openTime} - {$closeTime}",
            ];
        }

        // 4. Daily Open / Close time check
        $currentTime = $now->format('H:i');

        if ($currentTime >= $openTime && $currentTime < $closeTime) {
            return [
                'is_open' => true,
                'status' => 'open',
                'sub_status' => 'open_regular',
                'label' => 'Buka',
                'badge_text' => "Buka · Tutup {$closeTime}",
                'badge_color' => 'emerald',
                'open_time' => $openTime,
                'close_time' => $closeTime,
                'closure_reason' => null,
                'reopen_date' => null,
                'reopen_date_formatted' => null,
                'schedule_info' => "Buka {$openTime} - {$closeTime}",
            ];
        }

        if ($currentTime < $openTime) {
            return [
                'is_open' => false,
                'status' => 'closed',
                'sub_status' => 'closed_before_open',
                'label' => 'Tutup',
                'badge_text' => "Tutup · Buka {$openTime}",
                'badge_color' => 'amber',
                'open_time' => $openTime,
                'close_time' => $closeTime,
                'closure_reason' => null,
                'reopen_date' => null,
                'reopen_date_formatted' => null,
                'schedule_info' => "Buka hari ini jam {$openTime} - {$closeTime}",
            ];
        }

        // After close time
        return [
            'is_open' => false,
            'status' => 'closed',
            'sub_status' => 'closed_after_close',
            'label' => 'Tutup',
            'badge_text' => "Tutup · Buka Besok {$openTime}",
            'badge_color' => 'rose',
            'open_time' => $openTime,
            'close_time' => $closeTime,
            'closure_reason' => null,
            'reopen_date' => null,
            'reopen_date_formatted' => null,
            'schedule_info' => "Tutup jam {$closeTime} · Buka kembali {$openTime}",
        ];
    }

    /**
     * Fallback for general store when no specific branch is configured.
     */
    public function getStoreDefaultStatus(?Carbon $now = null): array
    {
        $now = $now ? $now->copy() : Carbon::now(config('app.timezone', 'Asia/Jakarta'));

        $isTemporarilyClosed = Setting::getBool('store_is_temporarily_closed', false);
        $closureReason = trim((string) Setting::get('store_closure_reason', ''));
        $rawReopen = Setting::get('store_reopen_date', '');
        $reopenDate = $rawReopen ? Carbon::parse($rawReopen) : null;

        if ($isTemporarilyClosed) {
            if ($reopenDate && $now->startOfDay()->gt($reopenDate->startOfDay())) {
                $isTemporarilyClosed = false;
            } else {
                $reopenFormatted = $reopenDate ? $reopenDate->translatedFormat('d M Y') : null;
                $badgeText = 'Tutup Sementara';
                if ($closureReason) {
                    $badgeText .= ' · '.$closureReason;
                }

                return [
                    'is_open' => false,
                    'status' => 'temporarily_closed',
                    'sub_status' => 'temporarily_closed',
                    'label' => 'Tutup Sementara',
                    'badge_text' => $badgeText,
                    'badge_color' => 'rose',
                    'closure_reason' => $closureReason,
                    'reopen_date' => $reopenFormatted,
                    'reopen_date_formatted' => $reopenFormatted,
                    'reopen_date_raw' => $rawReopen ?: null,
                    'schedule_info' => $closureReason ? "Tutup sementara: {$closureReason}" : 'Tutup sementara',
                ];
            }
        }

        if (Setting::getBool('store_is_24_hours', false)) {
            return [
                'is_open' => true,
                'status' => 'open',
                'sub_status' => 'open_24h',
                'is_24_hours' => true,
                'label' => 'Buka',
                'badge_text' => 'Buka 24 Jam',
                'badge_color' => 'emerald',
                'closure_reason' => null,
                'reopen_date' => null,
                'reopen_date_formatted' => null,
                'schedule_info' => 'Buka 24 Jam Setiap Hari',
            ];
        }

        $openTime = Setting::get('store_open_time', '08:00');
        $closeTime = Setting::get('store_close_time', '21:00');
        $currentTime = $now->format('H:i');

        if ($currentTime >= $openTime && $currentTime < $closeTime) {
            return [
                'is_open' => true,
                'status' => 'open',
                'sub_status' => 'open_regular',
                'label' => 'Buka',
                'badge_text' => "Buka · Tutup {$closeTime}",
                'badge_color' => 'emerald',
                'open_time' => $openTime,
                'close_time' => $closeTime,
                'closure_reason' => null,
                'reopen_date' => null,
                'reopen_date_formatted' => null,
                'schedule_info' => "Buka {$openTime} - {$closeTime}",
            ];
        }

        if ($currentTime < $openTime) {
            return [
                'is_open' => false,
                'status' => 'closed',
                'sub_status' => 'closed_before_open',
                'label' => 'Tutup',
                'badge_text' => "Tutup · Buka {$openTime}",
                'badge_color' => 'amber',
                'open_time' => $openTime,
                'close_time' => $closeTime,
                'closure_reason' => null,
                'reopen_date' => null,
                'reopen_date_formatted' => null,
                'schedule_info' => "Buka jam {$openTime} - {$closeTime}",
            ];
        }

        return [
            'is_open' => false,
            'status' => 'closed',
            'sub_status' => 'closed_after_close',
            'label' => 'Tutup',
            'badge_text' => "Tutup · Buka Besok {$openTime}",
            'badge_color' => 'rose',
            'open_time' => $openTime,
            'close_time' => $closeTime,
            'closure_reason' => null,
            'reopen_date' => null,
            'reopen_date_formatted' => null,
            'schedule_info' => "Tutup jam {$closeTime} · Buka kembali {$openTime}",
        ];
    }
}
