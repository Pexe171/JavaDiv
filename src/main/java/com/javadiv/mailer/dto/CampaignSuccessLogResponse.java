package com.javadiv.mailer.dto;

import java.time.OffsetDateTime;

public record CampaignSuccessLogResponse(
        String email,
        OffsetDateTime sentAt
) {}
