package com.javadiv.mailer.service;

import com.javadiv.mailer.config.MailBatchProperties;
import com.javadiv.mailer.domain.*;
import com.javadiv.mailer.dto.MailBatchConfigResponse;
import com.javadiv.mailer.dto.UpdateMailBatchConfigRequest;
import com.javadiv.mailer.exception.BusinessException;
import com.javadiv.mailer.repository.CampaignRecipientRepository;
import com.javadiv.mailer.repository.CampaignRepository;
import com.javadiv.mailer.repository.ContactRepository;
import org.springframework.core.task.TaskExecutor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CampaignServiceTest {

    @Mock
    private CampaignRepository campaignRepository;
    @Mock
    private CampaignRecipientRepository recipientRepository;
    @Mock
    private ContactRepository contactRepository;
    @Mock
    private MailSenderService mailSenderService;
    @Mock
    private UnsubscribeService unsubscribeService;
    @Mock
    private TaskExecutor taskExecutor;

    @Captor
    private ArgumentCaptor<CampaignRecipient> recipientCaptor;

    private CampaignService campaignService;

    @BeforeEach
    void setUp() {
        campaignService = new CampaignService(
                campaignRepository,
                recipientRepository,
                contactRepository,
                mailSenderService,
                unsubscribeService,
                taskExecutor,
                new MailBatchProperties(100, 0)
        );
    }

    @Test
    void deveDelegarEnvioAssincronoAoSolicitarDisparoImediato() {
        Campaign campaign = new Campaign();
        campaign.setId(1L);

        when(campaignRepository.findById(1L)).thenReturn(Optional.of(campaign));
        doAnswer(invocation -> {
            Runnable runnable = invocation.getArgument(0);
            runnable.run();
            return null;
        }).when(taskExecutor).execute(any(Runnable.class));

        campaignService.sendNow(1L);

        verify(taskExecutor).execute(any(Runnable.class));
        verify(campaignRepository, atLeastOnce()).save(any(Campaign.class));
    }

    @Test
    void deveMarcarFalhaQuandoEnvioLancarExcecao() {
        Campaign campaign = new Campaign();
        campaign.setId(2L);

        Contact contatoElegivel = new Contact();
        contatoElegivel.setId(20L);
        contatoElegivel.setEmail("falha@email.com");

        when(campaignRepository.findById(2L)).thenReturn(Optional.of(campaign));
        when(contactRepository.findByConsentimentoTrueAndUnsubscribedAtIsNullAndInscritoLivesTrue())
                .thenReturn(List.of(contatoElegivel));
        when(recipientRepository.existsByCampaignIdAndContactId(2L, 20L)).thenReturn(false);
        when(unsubscribeService.getOrCreateToken(20L)).thenReturn("token");
        doThrow(new org.springframework.mail.MailSendException("erro smtp"))
                .when(mailSenderService).sendCampaignEmail(any(), any(), any());

        campaignService.processCampaign(2L);

        verify(recipientRepository, atLeast(2)).save(recipientCaptor.capture());
        CampaignRecipient ultimo = recipientCaptor.getValue();
        org.junit.jupiter.api.Assertions.assertEquals(RecipientStatus.FAILED, ultimo.getStatus());
        verify(campaignRepository, atLeastOnce()).save(any(Campaign.class));
    }


    @Test
    void deveMarcarFalhaQuandoOcorrerErroInesperadoNoEnvio() {
        Campaign campaign = new Campaign();
        campaign.setId(3L);

        Contact contatoElegivel = new Contact();
        contatoElegivel.setId(30L);
        contatoElegivel.setEmail("inesperado@email.com");

        when(campaignRepository.findById(3L)).thenReturn(Optional.of(campaign));
        when(contactRepository.findByConsentimentoTrueAndUnsubscribedAtIsNullAndInscritoLivesTrue())
                .thenReturn(List.of(contatoElegivel));
        when(recipientRepository.existsByCampaignIdAndContactId(3L, 30L)).thenReturn(false);
        when(unsubscribeService.getOrCreateToken(30L)).thenReturn("token");
        doThrow(new RuntimeException("erro inesperado"))
                .when(mailSenderService).sendCampaignEmail(any(), any(), any());

        campaignService.processCampaign(3L);

        verify(recipientRepository, atLeast(2)).save(recipientCaptor.capture());
        CampaignRecipient ultimo = recipientCaptor.getValue();
        org.junit.jupiter.api.Assertions.assertEquals(RecipientStatus.FAILED, ultimo.getStatus());
        org.junit.jupiter.api.Assertions.assertEquals("erro inesperado", ultimo.getErrorMessage());
    }

    @Test
    void deveAtualizarConfiguracaoDeLoteEmMemoria() {
        MailBatchConfigResponse resposta = campaignService.updateMailBatchConfig(
                new UpdateMailBatchConfigRequest(25, 12)
        );

        assertEquals(25, resposta.mailBatchSize());
        assertEquals(12, resposta.mailBatchIntervalSeconds());
        assertEquals(25, campaignService.mailBatchConfig().mailBatchSize());
        assertEquals(12, campaignService.mailBatchConfig().mailBatchIntervalSeconds());
    }

    @Test
    void deveValidarConfiguracaoDeLoteInvalida() {
        assertThrows(
                BusinessException.class,
                () -> campaignService.updateMailBatchConfig(new UpdateMailBatchConfigRequest(0, 10))
        );
        assertThrows(
                BusinessException.class,
                () -> campaignService.updateMailBatchConfig(new UpdateMailBatchConfigRequest(10, -1))
        );
    }
}
