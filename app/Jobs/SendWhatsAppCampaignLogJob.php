<?php

namespace App\Jobs;

use App\Models\CustomerCampaign;
use App\Models\CustomerCampaignLog;
use App\Models\Setting;
use App\Services\CrmAutomationService;
use App\Services\WhatsAppService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendWhatsAppCampaignLogJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public array $backoff = [5, 15, 30];

    public int $timeout = 30;

    public function __construct(
        public CustomerCampaignLog $log
    ) {}

    public function handle(WhatsAppService $whatsAppService, CrmAutomationService $crmAutomationService): void
    {
        $this->log->refresh();

        if ($this->log->status === CustomerCampaignLog::STATUS_SENT || $this->log->status === CustomerCampaignLog::STATUS_SKIPPED) {
            return;
        }

        if ($this->log->campaign?->status === CustomerCampaign::STATUS_CANCELLED) {
            return;
        }

        $target = $this->log->customer?->no_telp
            ?? $this->log->receivable?->customer?->no_telp
            ?? ($this->log->payload['phone'] ?? null)
            ?? ($this->log->payload['target'] ?? null);

        $message = $this->log->payload['message'] ?? null;

        if (! $target || ! $message) {
            $crmAutomationService->markLog($this->log, CustomerCampaignLog::STATUS_SKIPPED);

            return;
        }

        if (! Setting::getBool('wa_enabled', false) || ! Setting::get('wa_service_url')) {
            Log::warning("WhatsApp Gateway dinonaktifkan atau URL belum diset saat mengeksekusi log #{$this->log->id}");

            return;
        }

        $status = $whatsAppService->status();
        if (! ($status['connected'] ?? false)) {
            throw new \RuntimeException("WhatsApp Gateway belum terhubung/terputus untuk pengiriman ke {$target}.");
        }

        $sent = $whatsAppService->send($target, $message);

        if ($sent) {
            $crmAutomationService->markLog($this->log, CustomerCampaignLog::STATUS_SENT);
        } else {
            throw new \RuntimeException("Gagal mengirim pesan WhatsApp ke nomor {$target}.");
        }
    }

    public function failed(?\Throwable $exception): void
    {
        Log::error("SendWhatsAppCampaignLogJob gagal untuk Log #{$this->log->id}: ".($exception?->getMessage() ?? 'Unknown error'));
    }
}
