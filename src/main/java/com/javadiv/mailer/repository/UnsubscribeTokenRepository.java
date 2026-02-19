package com.javadiv.mailer.repository;

import com.javadiv.mailer.domain.UnsubscribeToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UnsubscribeTokenRepository extends JpaRepository<UnsubscribeToken, Long> {
    Optional<UnsubscribeToken> findByToken(String token);
    Optional<UnsubscribeToken> findTopByContactIdOrderByCreatedAtDesc(Long contactId);
}
