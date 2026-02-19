package com.javadiv.mailer.service;

import com.javadiv.mailer.domain.Contact;
import com.javadiv.mailer.domain.UnsubscribeToken;
import com.javadiv.mailer.dto.UnsubscribeResponse;
import com.javadiv.mailer.exception.NotFoundException;
import com.javadiv.mailer.repository.ContactRepository;
import com.javadiv.mailer.repository.UnsubscribeTokenRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
public class UnsubscribeService {

    private final UnsubscribeTokenRepository unsubscribeTokenRepository;
    private final ContactRepository contactRepository;

    public UnsubscribeService(UnsubscribeTokenRepository unsubscribeTokenRepository, ContactRepository contactRepository) {
        this.unsubscribeTokenRepository = unsubscribeTokenRepository;
        this.contactRepository = contactRepository;
    }

    @Transactional
    public String getOrCreateToken(Long contactId) {
        return unsubscribeTokenRepository.findTopByContactIdOrderByCreatedAtDesc(contactId)
                .map(UnsubscribeToken::getToken)
                .orElseGet(() -> {
                    Contact contact = contactRepository.findById(contactId)
                            .orElseThrow(() -> new NotFoundException("Contato não encontrado para token"));
                    UnsubscribeToken token = new UnsubscribeToken();
                    token.setContact(contact);
                    token.setToken(UUID.randomUUID().toString());
                    return unsubscribeTokenRepository.save(token).getToken();
                });
    }

    @Transactional
    public UnsubscribeResponse unsubscribe(String tokenValue) {
        UnsubscribeToken token = unsubscribeTokenRepository.findByToken(tokenValue)
                .orElseThrow(() -> new NotFoundException("Token de descadastro inválido"));

        if (token.getUsedAt() == null) {
            token.setUsedAt(OffsetDateTime.now());
            Contact contact = token.getContact();
            if (contact.getUnsubscribedAt() == null) {
                contact.setUnsubscribedAt(OffsetDateTime.now());
                contactRepository.save(contact);
            }
            unsubscribeTokenRepository.save(token);
        }

        return new UnsubscribeResponse("Descadastro realizado com sucesso.");
    }
}
