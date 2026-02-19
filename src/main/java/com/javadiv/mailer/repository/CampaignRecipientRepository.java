package com.javadiv.mailer.repository;

import com.javadiv.mailer.domain.CampaignRecipient;
import com.javadiv.mailer.domain.RecipientStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CampaignRecipientRepository extends JpaRepository<CampaignRecipient, Long> {
    boolean existsByCampaignIdAndContactId(Long campaignId, Long contactId);
    long countByCampaignIdAndStatus(Long campaignId, RecipientStatus status);
    List<CampaignRecipient> findTop50ByCampaignIdAndStatusOrderByIdDesc(Long campaignId, RecipientStatus status);
    List<CampaignRecipient> findTop50ByCampaignIdAndStatusAndSentAtIsNotNullOrderBySentAtDesc(Long campaignId, RecipientStatus status);
}
