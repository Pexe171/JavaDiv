package com.javadiv.mailer.domain;

import jakarta.persistence.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "contacts")
public class Contact {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nome;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private boolean consentimento;

    @Column(nullable = false)
    private boolean inscritoLives;

    private OffsetDateTime unsubscribedAt;

    @Column(nullable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
    }

    public boolean isUnsubscribed() {
        return unsubscribedAt != null;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getNome() { return nome; }
    public void setNome(String nome) { this.nome = nome; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public boolean isConsentimento() { return consentimento; }
    public void setConsentimento(boolean consentimento) { this.consentimento = consentimento; }
    public boolean isInscritoLives() { return inscritoLives; }
    public void setInscritoLives(boolean inscritoLives) { this.inscritoLives = inscritoLives; }
    public OffsetDateTime getUnsubscribedAt() { return unsubscribedAt; }
    public void setUnsubscribedAt(OffsetDateTime unsubscribedAt) { this.unsubscribedAt = unsubscribedAt; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
