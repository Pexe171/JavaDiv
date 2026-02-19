package com.javadiv.mailer.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.mail.MailProperties;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class MailConfigTest {

    private final MailConfig mailConfig = new MailConfig();

    @Test
    void deveRemoverAspasDeValoresDeSmtp() {
        MailProperties properties = new MailProperties();
        properties.setHost("\"smtp.gmail.com\"");
        properties.setPort(465);
        properties.setUsername("'usuario@gmail.com'");
        properties.setPassword("\"senha-app\"");
        properties.setProtocol("\"smtps\"");
        properties.getProperties().put("mail.smtp.auth", "true");

        JavaMailSenderImpl sender = (JavaMailSenderImpl) mailConfig.javaMailSender(properties);

        assertEquals("smtp.gmail.com", sender.getHost());
        assertEquals("usuario@gmail.com", sender.getUsername());
        assertEquals("senha-app", sender.getPassword());
        assertEquals("smtps", sender.getProtocol());
        assertEquals("true", sender.getJavaMailProperties().getProperty("mail.smtp.auth"));
    }

    @Test
    void deveAtivarSslPorPadraoQuandoPortaFor465ESemTlsConfigurado() {
        MailProperties properties = new MailProperties();
        properties.setPort(465);

        JavaMailSenderImpl sender = (JavaMailSenderImpl) mailConfig.javaMailSender(properties);

        assertEquals("true", sender.getJavaMailProperties().getProperty("mail.smtp.ssl.enable"));
        assertEquals("false", sender.getJavaMailProperties().getProperty("mail.smtp.starttls.enable"));
    }

    @Test
    void deveRespeitarConfiguracaoExistenteDeStartTlsNaPorta465() {
        MailProperties properties = new MailProperties();
        properties.setPort(465);
        properties.getProperties().put("mail.smtp.starttls.enable", "true");

        JavaMailSenderImpl sender = (JavaMailSenderImpl) mailConfig.javaMailSender(properties);

        assertEquals("true", sender.getJavaMailProperties().getProperty("mail.smtp.starttls.enable"));
        assertNull(sender.getJavaMailProperties().getProperty("mail.smtp.ssl.enable"));
    }

    @Test
    void deveManterValorQuandoNaoHaAspasExternas() {
        assertEquals("smtp.gmail.com", MailConfig.sanitize(" smtp.gmail.com "));
        assertEquals("smtp\".gmail.com", MailConfig.sanitize("smtp\".gmail.com"));
    }
}
