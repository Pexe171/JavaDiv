package com.javadiv.mailer.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(MailBatchProperties.class)
public class AppConfig {
}
