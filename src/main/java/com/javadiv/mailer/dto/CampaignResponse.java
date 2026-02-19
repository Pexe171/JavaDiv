package com.javadiv.mailer.dto;

import com.javadiv.mailer.domain.CampaignStatus;

import java.time.OffsetDateTime;

public record CampaignResponse(
        Long id,
        String titulo,
        String assunto,
        String conteudoHtml,
        CampaignStatus status,
        OffsetDateTime scheduledAt,
        OffsetDateTime createdAt
) {}
