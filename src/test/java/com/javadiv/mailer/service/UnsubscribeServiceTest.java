package com.javadiv.mailer.service;

import com.javadiv.mailer.domain.Contact;
import com.javadiv.mailer.domain.UnsubscribeToken;
import com.javadiv.mailer.dto.UnsubscribeResponse;
import com.javadiv.mailer.repository.ContactRepository;
import com.javadiv.mailer.repository.UnsubscribeTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UnsubscribeServiceTest {

    @Mock
    private UnsubscribeTokenRepository tokenRepository;
    @Mock
    private ContactRepository contactRepository;

    private UnsubscribeService unsubscribeService;

    @BeforeEach
    void setUp() {
        unsubscribeService = new UnsubscribeService(tokenRepository, contactRepository);
    }

    @Test
    void deveDescadastrarContatoQuandoTokenValido() {
        Contact contact = new Contact();
        contact.setId(1L);

        UnsubscribeToken token = new UnsubscribeToken();
        token.setToken("abc");
        token.setContact(contact);

        when(tokenRepository.findByToken("abc")).thenReturn(Optional.of(token));

        UnsubscribeResponse response = unsubscribeService.unsubscribe("abc");

        assertTrue(response.message().contains("sucesso"));
        assertNotNull(contact.getUnsubscribedAt());
        assertNotNull(token.getUsedAt());
        verify(contactRepository).save(contact);
    }

    @Test
    void deveReutilizarTokenMaisRecente() {
        UnsubscribeToken token = new UnsubscribeToken();
        token.setToken("existente");
        token.setCreatedAt(OffsetDateTime.now());

        when(tokenRepository.findTopByContactIdOrderByCreatedAtDesc(10L)).thenReturn(Optional.of(token));

        String valor = unsubscribeService.getOrCreateToken(10L);

        assertEquals("existente", valor);
        verify(tokenRepository, never()).save(any());
    }
}
