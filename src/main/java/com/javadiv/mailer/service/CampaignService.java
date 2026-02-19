package com.javadiv.mailer.service;

import com.javadiv.mailer.config.MailBatchProperties;
import com.javadiv.mailer.domain.*;
import com.javadiv.mailer.dto.*;
import com.javadiv.mailer.exception.NotFoundException;
import com.javadiv.mailer.exception.BusinessException;
import com.javadiv.mailer.repository.CampaignRecipientRepository;
import com.javadiv.mailer.repository.CampaignRepository;
import com.javadiv.mailer.repository.ContactRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.MailException;
import org.springframework.stereotype.Service;
import org.springframework.core.task.TaskExecutor;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
public class CampaignService {

    private static final Logger log = LoggerFactory.getLogger(CampaignService.class);

    private final CampaignRepository campaignRepository;
    private final CampaignRecipientRepository recipientRepository;
    private final ContactRepository contactRepository;
    private final MailSenderService mailSenderService;
    private final UnsubscribeService unsubscribeService;
    private final TaskExecutor taskExecutor;
    private final MailBatchProperties mailBatchProperties;
    private volatile int currentBatchSize;
    private volatile int currentBatchIntervalSeconds;

    public CampaignService(CampaignRepository campaignRepository,
                           CampaignRecipientRepository recipientRepository,
                           ContactRepository contactRepository,
                           MailSenderService mailSenderService,
                           UnsubscribeService unsubscribeService,
                           TaskExecutor taskExecutor,
                           MailBatchProperties mailBatchProperties) {
        this.campaignRepository = campaignRepository;
        this.recipientRepository = recipientRepository;
        this.contactRepository = contactRepository;
        this.mailSenderService = mailSenderService;
        this.unsubscribeService = unsubscribeService;
        this.taskExecutor = taskExecutor;
        this.mailBatchProperties = mailBatchProperties;
        this.currentBatchSize = mailBatchProperties.batchSize();
        this.currentBatchIntervalSeconds = mailBatchProperties.batchIntervalSeconds();
    }

    @Transactional
    public CampaignResponse create(CreateCampaignRequest request) {
        Campaign campaign = new Campaign();
        campaign.setTitulo(request.titulo());
        campaign.setAssunto(request.assunto());
        campaign.setConteudoHtml(request.conteudoHtml());
        campaign.setStatus(CampaignStatus.DRAFT);
        return toResponse(campaignRepository.save(campaign));
    }

    @Transactional
    public CampaignResponse schedule(Long id, ScheduleCampaignRequest request) {
        Campaign campaign = getCampaign(id);
        campaign.setScheduledAt(request.scheduledAt());
        campaign.setStatus(CampaignStatus.SCHEDULED);
        return toResponse(campaignRepository.save(campaign));
    }

    @Transactional
    public void sendNow(Long id) {
        Campaign campaign = getCampaign(id);
        campaign.setStatus(CampaignStatus.SENDING);
        campaignRepository.save(campaign);
        taskExecutor.execute(() -> processCampaign(campaign.getId()));
    }

    @Transactional
    public void processScheduledCampaigns() {
        List<Campaign> dueCampaigns = campaignRepository.findByStatusAndScheduledAtLessThanEqual(CampaignStatus.SCHEDULED, OffsetDateTime.now());
        dueCampaigns.forEach(campaign -> {
            campaign.setStatus(CampaignStatus.SENDING);
            campaignRepository.save(campaign);
            taskExecutor.execute(() -> processCampaign(campaign.getId()));
        });
    }

    @Transactional
    public void processCampaign(Long campaignId) {
        Campaign campaign = getCampaign(campaignId);
        processCampaign(campaign);
    }

    @Transactional(readOnly = true)
    public CampaignStatusResponse status(Long id) {
        Campaign campaign = getCampaign(id);
        List<CampaignErrorLogResponse> erros = recipientRepository
                .findTop50ByCampaignIdAndStatusOrderByIdDesc(id, RecipientStatus.FAILED)
                .stream()
                .map(recipient -> new CampaignErrorLogResponse(
                        recipient.getContact().getEmail(),
                        recipient.getErrorMessage(),
                        recipient.getSentAt()
                ))
                .toList();

        List<CampaignSuccessLogResponse> enviosComSucesso = recipientRepository
                .findTop50ByCampaignIdAndStatusAndSentAtIsNotNullOrderBySentAtDesc(id, RecipientStatus.SENT)
                .stream()
                .map(recipient -> new CampaignSuccessLogResponse(
                        recipient.getContact().getEmail(),
                        recipient.getSentAt()
                ))
                .toList();

        return new CampaignStatusResponse(
                campaign.getId(),
                campaign.getStatus(),
                recipientRepository.countByCampaignIdAndStatus(id, RecipientStatus.PENDING),
                recipientRepository.countByCampaignIdAndStatus(id, RecipientStatus.SENT),
                recipientRepository.countByCampaignIdAndStatus(id, RecipientStatus.FAILED),
                enviosComSucesso,
                erros
        );
    }

    @Transactional(readOnly = true)
    public MailBatchConfigResponse mailBatchConfig() {
        return new MailBatchConfigResponse(
                currentBatchSize,
                currentBatchIntervalSeconds
        );
    }

    @Transactional
    public MailBatchConfigResponse updateMailBatchConfig(UpdateMailBatchConfigRequest request) {
        if (request.mailBatchSize() < 1) {
            throw new BusinessException("MAIL_BATCH_SIZE deve ser maior que zero.");
        }

        if (request.mailBatchIntervalSeconds() < 0) {
            throw new BusinessException("MAIL_BATCH_INTERVAL_SECONDS não pode ser negativo.");
        }

        currentBatchSize = request.mailBatchSize();
        currentBatchIntervalSeconds = request.mailBatchIntervalSeconds();

        return mailBatchConfig();
    }

    private void processCampaign(Campaign campaign) {
        List<Contact> contacts = contactRepository.findByConsentimentoTrueAndUnsubscribedAtIsNullAndInscritoLivesTrue();
        log.info("campaign_dispatch status=started campaignId={} eligibleContacts={}", campaign.getId(), contacts.size());

        if (contacts.isEmpty()) {
            log.warn("campaign_dispatch status=no_eligible_contacts campaignId={}", campaign.getId());
        }

        int processed = 0;
        int sent = 0;
        int failed = 0;

        for (Contact contact : contacts) {
            if (recipientRepository.existsByCampaignIdAndContactId(campaign.getId(), contact.getId())) {
                continue;
            }

            CampaignRecipient recipient = new CampaignRecipient();
            recipient.setCampaign(campaign);
            recipient.setContact(contact);
            recipient.setStatus(RecipientStatus.PENDING);
            recipientRepository.save(recipient);

            String token = unsubscribeService.getOrCreateToken(contact.getId());

            try {
                mailSenderService.sendCampaignEmail(campaign, contact, token);
                recipient.setStatus(RecipientStatus.SENT);
                recipient.setSentAt(OffsetDateTime.now());
                recipient.setErrorMessage(null);
                sent++;
            } catch (MailException ex) {
                recipient.setStatus(RecipientStatus.FAILED);
                recipient.setErrorMessage(ex.getMessage());
                failed++;
                log.error("campaign_dispatch status=mail_exception campaignId={} contactId={} email={} reason={}",
                        campaign.getId(),
                        contact.getId(),
                        contact.getEmail(),
                        ex.getMessage());
            } catch (Exception ex) {
                recipient.setStatus(RecipientStatus.FAILED);
                recipient.setErrorMessage(ex.getMessage());
                failed++;
                log.error("campaign_dispatch status=unexpected_error campaignId={} contactId={} email={} reason={}",
                        campaign.getId(),
                        contact.getId(),
                        contact.getEmail(),
                        ex.getMessage());
            }

            recipientRepository.save(recipient);
            processed++;
            if (processed % currentBatchSize == 0) {
                sleepBatchInterval();
            }
        }

        campaign.setStatus(CampaignStatus.FINISHED);
        campaignRepository.save(campaign);
        log.info("campaign_dispatch status=finished campaignId={} processed={} sent={} failed={}",
                campaign.getId(),
                processed,
                sent,
                failed);
    }

    private void sleepBatchInterval() {
        try {
            Thread.sleep(currentBatchIntervalSeconds * 1000L);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private Campaign getCampaign(Long id) {
        return campaignRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Campanha não encontrada"));
    }

    private CampaignResponse toResponse(Campaign campaign) {
        return new CampaignResponse(
                campaign.getId(),
                campaign.getTitulo(),
                campaign.getAssunto(),
                campaign.getConteudoHtml(),
                campaign.getStatus(),
                campaign.getScheduledAt(),
                campaign.getCreatedAt()
        );
    }
}
