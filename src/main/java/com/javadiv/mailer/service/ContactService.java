package com.javadiv.mailer.service;

import com.javadiv.mailer.domain.Contact;
import com.javadiv.mailer.dto.ContactResponse;
import com.javadiv.mailer.dto.CreateContactRequest;
import com.javadiv.mailer.dto.ImportContactsResponse;
import com.javadiv.mailer.exception.BusinessException;
import com.javadiv.mailer.repository.ContactRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class ContactService {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$");

    private final ContactRepository contactRepository;

    public ContactService(ContactRepository contactRepository) {
        this.contactRepository = contactRepository;
    }

    @Transactional
    public ContactResponse create(CreateContactRequest request) {
        contactRepository.findByEmailIgnoreCase(request.email()).ifPresent(c -> {
            throw new BusinessException("Já existe contato com este e-mail");
        });

        Contact contact = new Contact();
        contact.setNome(request.nome());
        contact.setEmail(request.email().toLowerCase());
        contact.setConsentimento(request.consentimento());
        contact.setInscritoLives(request.inscritoLives());

        return toResponse(contactRepository.save(contact));
    }

    @Transactional
    public ImportContactsResponse importByLines(String linhasEmails) {
        String normalizedInput = linhasEmails == null ? "" : linhasEmails;
        String[] lines = normalizedInput.split("\\R");

        List<String> imported = new ArrayList<>();
        List<String> invalid = new ArrayList<>();
        List<String> duplicated = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();

        for (String rawLine : lines) {
            String email = normalizeEmail(rawLine);
            if (email.isBlank()) {
                continue;
            }

            if (!isValidEmail(email)) {
                invalid.add(email);
                continue;
            }

            if (!seen.add(email) || contactRepository.findByEmailIgnoreCase(email).isPresent()) {
                duplicated.add(email);
                continue;
            }

            Contact contact = new Contact();
            contact.setNome(buildNameFromEmail(email));
            contact.setEmail(email);
            contact.setConsentimento(true);
            contact.setInscritoLives(true);
            contactRepository.save(contact);
            imported.add(email);
        }

        return new ImportContactsResponse(
                lines.length,
                imported.size(),
                invalid.size(),
                duplicated.size(),
                imported,
                invalid,
                duplicated
        );
    }

    @Transactional(readOnly = true)
    public List<ContactResponse> listAll() {
        return contactRepository.findAll().stream().map(this::toResponse).toList();
    }

    private String normalizeEmail(String raw) {
        return raw == null ? "" : raw.trim().toLowerCase();
    }

    private boolean isValidEmail(String email) {
        return EMAIL_PATTERN.matcher(email).matches();
    }

    private String buildNameFromEmail(String email) {
        return email.split("@")[0];
    }

    ContactResponse toResponse(Contact contact) {
        return new ContactResponse(
                contact.getId(),
                contact.getNome(),
                contact.getEmail(),
                contact.isConsentimento(),
                contact.isInscritoLives(),
                contact.getUnsubscribedAt(),
                contact.getCreatedAt()
        );
    }
}
