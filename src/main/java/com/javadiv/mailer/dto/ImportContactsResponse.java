package com.javadiv.mailer.dto;

import java.util.List;

public record ImportContactsResponse(
        int totalLinhas,
        int importados,
        int ignoradosInvalidos,
        int ignoradosDuplicados,
        List<String> emailsImportados,
        List<String> emailsInvalidos,
        List<String> emailsDuplicados
) {
}
