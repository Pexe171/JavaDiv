package com.javadiv.mailer.dto;

import java.time.OffsetDateTime;

public record CampaignErrorLogResponse(
        String email,
        String errorMessage,
        OffsetDateTime sentAt
) {}
