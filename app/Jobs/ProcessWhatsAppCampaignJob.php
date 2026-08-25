<?php

namespace App\Jobs;

use App\Models\CustomerCampaign;
use App\Services\CrmAutomationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessWhatsAppCampaignJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 60;

    public function __construct(
        public CustomerCampaign $campaign
    ) {}

    public function handle(CrmAutomationService $crmAutomationService): void
    {
        $crmAutomationService->dispatchCampaignQueue($this->campaign);
    }
}
