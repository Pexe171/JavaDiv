package com.javadiv.mailer.scheduler;

import com.javadiv.mailer.service.CampaignService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class CampaignScheduler {

    private final CampaignService campaignService;

    public CampaignScheduler(CampaignService campaignService) {
        this.campaignService = campaignService;
    }

    @Scheduled(fixedDelayString = "${app.scheduler.fixed-delay-ms:30000}")
    public void run() {
        campaignService.processScheduledCampaigns();
    }
}
