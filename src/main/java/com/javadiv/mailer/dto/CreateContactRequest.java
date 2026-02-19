package com.javadiv.mailer.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateContactRequest(
        @NotBlank String nome,
        @NotBlank @Email String email,
        @NotNull Boolean consentimento,
        @NotNull Boolean inscritoLives
) {}
