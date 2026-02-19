package com.javadiv.mailer.repository;

import com.javadiv.mailer.domain.Contact;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ContactRepository extends JpaRepository<Contact, Long> {
    Optional<Contact> findByEmailIgnoreCase(String email);
    List<Contact> findByConsentimentoTrueAndUnsubscribedAtIsNullAndInscritoLivesTrue();
}
