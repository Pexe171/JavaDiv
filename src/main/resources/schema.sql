CREATE TABLE IF NOT EXISTS contacts (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    consentimento BOOLEAN NOT NULL,
    inscrito_lives BOOLEAN NOT NULL,
    unsubscribed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
    id BIGSERIAL PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    assunto VARCHAR(255) NOT NULL,
    conteudo_html TEXT NOT NULL,
    status VARCHAR(30) NOT NULL,
    scheduled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS campaign_recipients (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES campaigns(id),
    contact_id BIGINT NOT NULL REFERENCES contacts(id),
    status VARCHAR(30) NOT NULL,
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    CONSTRAINT uk_campaign_contact UNIQUE (campaign_id, contact_id)
);

CREATE TABLE IF NOT EXISTS unsubscribe_tokens (
    id BIGSERIAL PRIMARY KEY,
    contact_id BIGINT NOT NULL REFERENCES contacts(id),
    token VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    CONSTRAINT uk_unsubscribe_token UNIQUE (token)
);
