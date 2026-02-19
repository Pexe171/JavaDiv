package com.javadiv.mailer.service;

import com.javadiv.mailer.domain.Contact;
import com.javadiv.mailer.dto.ImportContactsResponse;
import com.javadiv.mailer.repository.ContactRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ContactServiceTest {

    @Mock
    private ContactRepository contactRepository;

    private ContactService contactService;

    @BeforeEach
    void setUp() {
        contactService = new ContactService(contactRepository);
    }

    @Test
    void deveImportarEmailsPorLinhaIgnorandoInvalidosEDuplicados() {
        String payload = "ana@email.com\n\nEmail-Invalido\nANA@email.com\njoao@email.com\n";

        when(contactRepository.findByEmailIgnoreCase("ana@email.com")).thenReturn(Optional.empty());
        when(contactRepository.findByEmailIgnoreCase("joao@email.com")).thenReturn(Optional.empty());

        ImportContactsResponse response = contactService.importByLines(payload);

        assertEquals(2, response.importados());
        assertEquals(1, response.ignoradosInvalidos());
        assertEquals(1, response.ignoradosDuplicados());

        ArgumentCaptor<Contact> captor = ArgumentCaptor.forClass(Contact.class);
        verify(contactRepository, times(2)).save(captor.capture());
        assertEquals("ana", captor.getAllValues().get(0).getNome());
        assertEquals("joao", captor.getAllValues().get(1).getNome());
    }

    @Test
    void deveIgnorarEmailJaExistenteNoBanco() {
        String payload = "existente@email.com\nnovo@email.com";

        Contact existente = new Contact();
        existente.setEmail("existente@email.com");

        when(contactRepository.findByEmailIgnoreCase("existente@email.com")).thenReturn(Optional.of(existente));
        when(contactRepository.findByEmailIgnoreCase("novo@email.com")).thenReturn(Optional.empty());

        ImportContactsResponse response = contactService.importByLines(payload);

        assertEquals(1, response.importados());
        assertEquals(1, response.ignoradosDuplicados());
        verify(contactRepository, times(1)).save(any(Contact.class));
    }
}
