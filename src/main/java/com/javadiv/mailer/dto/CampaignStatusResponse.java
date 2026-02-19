package com.javadiv.mailer.dto;

import com.javadiv.mailer.domain.CampaignStatus;

import java.util.List;

public record CampaignStatusResponse(
        Long campaignId,
        CampaignStatus campaignStatus,
        long pending,
        long sent,
        long failed,
        List<CampaignSuccessLogResponse> enviosComSucesso,
        List<CampaignErrorLogResponse> erros
) {}
