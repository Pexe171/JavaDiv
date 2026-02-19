package com.javadiv.mailer.service;

import com.javadiv.mailer.domain.Campaign;
import com.javadiv.mailer.domain.Contact;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class MailSenderService {

    private static final Logger log = LoggerFactory.getLogger(MailSenderService.class);

    private final JavaMailSender javaMailSender;
    private final String from;

    public MailSenderService(JavaMailSender javaMailSender, @Value("${app.mail.from}") String from) {
        this.javaMailSender = javaMailSender;
        this.from = from;
    }

    public void sendCampaignEmail(Campaign campaign, Contact contact, String unsubscribeToken) {
        try {
            MimeMessage message = javaMailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(from);
            helper.setTo(contact.getEmail());
            helper.setSubject(campaign.getAssunto());

            String html = campaign.getConteudoHtml() +
                    "<hr/><p style='font-size:12px'>Não quer mais receber? <a href='http://localhost:8080/api/unsubscribe/" + unsubscribeToken + "'>Descadastre-se aqui</a>.</p>";
            helper.setText(html, true);

            javaMailSender.send(message);

            log.info("mail_send status=success campaignId={} contactId={} email={}", campaign.getId(), contact.getId(), contact.getEmail());
        } catch (MessagingException | MailSendException ex) {
            log.error("mail_send status=error campaignId={} contactId={} email={} reason={}", campaign.getId(), contact.getId(), contact.getEmail(), ex.getMessage());
            throw new MailSendException("Falha ao enviar e-mail", ex);
        }
    }
}
