package com.javadiv.mailer.config;

import org.springframework.boot.autoconfigure.mail.MailProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import java.util.Properties;

@Configuration
public class MailConfig {

    @Bean
    public JavaMailSender javaMailSender(MailProperties properties) {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(sanitize(properties.getHost()));
        sender.setPort(properties.getPort());
        sender.setUsername(sanitize(properties.getUsername()));
        sender.setPassword(sanitize(properties.getPassword()));

        if (properties.getProtocol() != null) {
            sender.setProtocol(sanitize(properties.getProtocol()));
        }

        sender.setJavaMailProperties(buildJavaMailProperties(properties));
        return sender;
    }

    private static Properties buildJavaMailProperties(MailProperties properties) {
        Properties sanitizedProperties = new Properties();
        sanitizedProperties.putAll(properties.getProperties());

        boolean hasSslConfig = sanitizedProperties.containsKey("mail.smtp.ssl.enable");
        boolean hasStartTlsConfig = sanitizedProperties.containsKey("mail.smtp.starttls.enable");

        if (properties.getPort() == 465 && !hasSslConfig && !hasStartTlsConfig) {
            sanitizedProperties.put("mail.smtp.ssl.enable", "true");
            sanitizedProperties.put("mail.smtp.starttls.enable", "false");
        }

        return sanitizedProperties;
    }

    static String sanitize(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        if (trimmed.length() >= 2) {
            boolean hasDoubleQuotes = trimmed.startsWith("\"") && trimmed.endsWith("\"");
            boolean hasSingleQuotes = trimmed.startsWith("'") && trimmed.endsWith("'");
            if (hasDoubleQuotes || hasSingleQuotes) {
                return trimmed.substring(1, trimmed.length() - 1).trim();
            }
        }
        return trimmed;
    }
}
