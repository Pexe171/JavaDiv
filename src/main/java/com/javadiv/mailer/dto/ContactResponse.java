package com.javadiv.mailer.dto;

import java.time.OffsetDateTime;

public record ContactResponse(
        Long id,
        String nome,
        String email,
        boolean consentimento,
        boolean inscritoLives,
        OffsetDateTime unsubscribedAt,
        OffsetDateTime createdAt
) {}
