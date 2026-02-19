package com.javadiv.mailer.dto;

import com.javadiv.mailer.domain.CampaignStatus;

public record CampaignStatusResponse(
        Long campaignId,
        CampaignStatus campaignStatus,
        long pending,
        long sent,
        long failed
) {}
