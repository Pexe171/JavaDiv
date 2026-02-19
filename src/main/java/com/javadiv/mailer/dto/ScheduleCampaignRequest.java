package com.javadiv.mailer.dto;

import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;

public record ScheduleCampaignRequest(
        @NotNull OffsetDateTime scheduledAt
) {}
