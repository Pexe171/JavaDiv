package com.javadiv.mailer.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.mail")
public record MailBatchProperties(int batchSize, int batchIntervalSeconds) {
}
