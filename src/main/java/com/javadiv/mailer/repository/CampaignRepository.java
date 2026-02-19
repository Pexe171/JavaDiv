package com.javadiv.mailer.repository;

import com.javadiv.mailer.domain.Campaign;
import com.javadiv.mailer.domain.CampaignStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;

public interface CampaignRepository extends JpaRepository<Campaign, Long> {
    List<Campaign> findByStatusAndScheduledAtLessThanEqual(CampaignStatus status, OffsetDateTime now);
}
