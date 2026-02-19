package com.javadiv.mailer.repository;

import com.javadiv.mailer.domain.CampaignRecipient;
import com.javadiv.mailer.domain.RecipientStatus;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CampaignRecipientRepository extends JpaRepository<CampaignRecipient, Long> {
    boolean existsByCampaignIdAndContactId(Long campaignId, Long contactId);
    long countByCampaignIdAndStatus(Long campaignId, RecipientStatus status);
}
