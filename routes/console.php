<?php

use App\Models\AuditLog;
use App\Models\Setting;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Schema;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote')->hourly();

Schedule::command('crm:sync-segments')->dailyAt('01:00');

$reminderTime = '09:15';
try {
    if (Schema::hasTable('settings')) {
        $configuredTime = Setting::get('wa_reminder_schedule_time');
        if ($configuredTime && preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $configuredTime)) {
            $reminderTime = $configuredTime;
        }
    }
} catch (Throwable) {
    $reminderTime = '09:15';
}

Schedule::command('crm:generate-reminders')->dailyAt($reminderTime);

Schedule::command('model:prune', [
    '--model' => [AuditLog::class],
])->dailyAt('02:30');
