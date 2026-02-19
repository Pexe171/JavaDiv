package com.javadiv.mailer.dto;

import jakarta.validation.constraints.Min;

public record UpdateMailBatchConfigRequest(
        @Min(1) int mailBatchSize,
        @Min(0) int mailBatchIntervalSeconds
) {
}
