package com.javadiv.mailer.dto;

public record MailBatchConfigResponse(
        int mailBatchSize,
        int mailBatchIntervalSeconds
) {}
