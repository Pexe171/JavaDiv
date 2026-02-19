package com.javadiv.mailer.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateCampaignRequest(
        @NotBlank String titulo,
        @NotBlank String assunto,
        @NotBlank String conteudoHtml
) {}
