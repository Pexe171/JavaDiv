# Lives Mailer (JavaDiv)

API para gestão e envio de campanhas de e-mail para inscritos em lives, com foco em consentimento, descadastro e histórico por destinatário.

## Stack e arquitetura

- **Java 21**
- **Spring Boot 3**
- Spring Web
- Spring Data JPA
- Bean Validation
- Scheduler para envio agendado
- PostgreSQL
- JavaMailSender (SMTP)
- Arquitetura em camadas:
  - `controller`: endpoints REST
  - `service`: regras de negócio
  - `repository`: acesso a dados
  - `domain`: entidades e enums
  - `dto`: contratos de entrada/saída

## Decisões de design

1. **Separação de responsabilidades**: cada camada trata somente da sua função para facilitar manutenção.
2. **Controle de consentimento e opt-out**: seleção de destinatários considera apenas quem deu consentimento e não se descadastrou.
3. **Histórico de envio por contato/campanha**: tabela `campaign_recipients` registra `PENDING`, `SENT` e `FAILED`.
4. **Não duplicidade**: constraint única `(campaign_id, contact_id)` + checagem de existência antes do envio.
5. **Rate limit por lote**: envio em lotes configuráveis por variáveis de ambiente (`MAIL_BATCH_SIZE`, `MAIL_BATCH_INTERVAL_SECONDS`).
6. **Pronto para evolução**: serviço de envio isolado, facilitando troca futura para filas (RabbitMQ/SQS).

## Regras de negócio implementadas

- ✅ Só envia e-mail para contato com `consentimento=true`.
- ✅ Contato com e-mail inválido não é aceito (Bean Validation no DTO).
- ✅ Não envia e-mail duplicado para mesmo contato na mesma campanha.
- ✅ Registra histórico por destinatário (`PENDING`, `SENT`, `FAILED`).
- ✅ Permite descadastro via token único.
- ✅ Contato descadastrado nunca recebe novas campanhas.

## Estrutura de endpoints

- `POST /api/contacts`
- `GET /api/contacts`
- `POST /api/contacts/import-lines` (texto puro com 1 e-mail por linha)
- `POST /api/campaigns`
- `POST /api/campaigns/{id}/schedule`
- `POST /api/campaigns/{id}/send-now`
- `GET /api/campaigns/{id}/status`
- `GET /api/campaigns/config`
- `PUT /api/campaigns/config`
- `GET /api/unsubscribe/{token}`

## Configuração via `.env`

Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

Variáveis esperadas:

```env
APP_PORT=8080
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lives_mailer
DB_USER=postgres
DB_PASS=postgres
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu_email@gmail.com
SMTP_PASS=sua_senha_de_app
SMTP_FROM="Seu Canal <seu_email@gmail.com>"
MAIL_BATCH_SIZE=50
MAIL_BATCH_INTERVAL_SECONDS=60
```

> Dica: use `source .env` antes de rodar a aplicação no terminal.


### Erro comum: `UnknownHostException: "smtp.gmail.com"`

Se o log mostrar o host SMTP com aspas (por exemplo `"smtp.gmail.com"`), o DNS tenta resolver o valor **com as aspas** e a conexão falha.

A aplicação agora sanitiza automaticamente aspas externas nas propriedades SMTP (`host`, `username`, `password` e `protocol`) para evitar esse problema em ambientes onde variáveis chegam com aspas extras.

Mesmo com essa proteção, prefira definir no `.env` sem aspas no host:

```env
SMTP_HOST=smtp.gmail.com
```

Se você usar **porta 465**, o SMTP normalmente exige SSL implícito. A aplicação agora ativa automaticamente:

- `mail.smtp.ssl.enable=true`
- `mail.smtp.starttls.enable=false`

quando detectar porta `465` e nenhuma dessas flags definida manualmente.

Se quiser controlar manualmente TLS/SSL, basta definir `spring.mail.properties.*` nas variáveis de ambiente.

## Setup local

### 1) Banco de dados

Crie o banco e aplique schema:

```bash
psql -U postgres -f src/main/resources/db/init.sql
psql -U postgres -d lives_mailer -f src/main/resources/schema.sql
```

### 2) Build e execução

```bash
mvn clean test
mvn spring-boot:run
```

## Exemplos de uso

Arquivo com cURLs: [`examples-curl.sh`](examples-curl.sh).

Rodar:

```bash
chmod +x examples-curl.sh
./examples-curl.sh
```

Exemplo rápido de importação por linhas:

```bash
curl -X POST "http://localhost:8080/api/contacts/import-lines" \
  -H "Content-Type: text/plain" \
  --data-binary $'email1@dominio.com\nemail2@dominio.com\nEmailInvalido\n'
```

O endpoint:
- converte e-mails para minúsculo;
- ignora linhas vazias;
- ignora e-mails inválidos;
- ignora duplicados no payload e já existentes no banco;
- cria contato com `nome` baseado no prefixo do e-mail e `consentimento=true`, `inscritoLives=true`.

## Tratamento de erros

A API possui `@RestControllerAdvice` com respostas padronizadas para:

- validação (`400`)
- regra de negócio (`400`)
- não encontrado (`404`)
- erro interno (`500`)

## Logs estruturados

No envio de e-mails, o sistema registra:

- campanha
- contato
- e-mail destino
- status (sucesso/erro)

Formato exemplo:

```text
mail_send status=success campaignId=1 contactId=10 email=ana@email.com
```

## Testes unitários

Inclui testes de serviços para regras críticas:

- envio e histórico de campanha
- falha de envio e status `FAILED`
- descadastro por token
- reaproveitamento de token existente

## Boas práticas anti-spam e LGPD

1. Envie apenas para contatos com consentimento explícito.
2. Mantenha opção clara de descadastro em todas as campanhas.
3. Registre quando e como o consentimento foi coletado (futuro incremento recomendado).
4. Evite excesso de frequência de envios para proteger reputação do domínio.
5. Monitore bounce/complaints para higienização de base (evolução futura).
6. Não armazene segredos em código; use variáveis de ambiente.

---

Projeto preparado para evolução com filas (RabbitMQ/SQS) sem quebrar a camada de API.


### Configuração de CORS (Back-end)

A API já está preparada com `WebConfig` para aceitar requisições do front-end em:

- `http://localhost:3000`

Mapeamento aplicado para rotas `/api/**`, incluindo métodos `GET`, `POST`, `PUT`, `PATCH`, `DELETE` e `OPTIONS`.

### Front-end (Next.js + Tailwind CSS)

O módulo web em `frontend/` foi simplificado para um fluxo de disparo rápido:

- Interface minimalista e chamativa para **envio de e-mail de live no TikTok**
- Bloco de **importação de contatos** com colagem em massa (1 e-mail por linha)
- Tratamento inteligente da importação: em entradas como `email@dominio.com:dados`, o sistema considera apenas o trecho antes de `:`
- Contador em tempo real com total de e-mails únicos identificados para importação
- Formulário com **apenas 1 campo**: link da live
- Geração automática de campanha com:
  - título padrão com data atual
  - assunto padrão para chamada de live ao vivo
  - HTML de e-mail pré-pronto com botão **"Clique aqui para assistir"**
- Disparo imediato logo após criação, usando `POST /api/campaigns` + `POST /api/campaigns/{id}/send-now`
- Disparo imediato **assíncrono**: a API responde rápido e o processamento segue em segundo plano
- Prévia visual do botão para validar rapidamente o link informado
- Mensagens claras de sucesso/erro na própria tela
- Monitoramento automático do status da campanha via `GET /api/campaigns/{id}/status`
- Painel com totais de `SENT`, `FAILED`, `PENDING`
- Lista dos últimos e-mails enviados com sucesso e logs de erro detalhados (e-mail + mensagem retornada)
- Aviso visual quando a campanha termina com `0` envios e `0` falhas (cenário típico de base sem contatos elegíveis)

#### Executar front-end

```bash
cd frontend
npm install
npm run dev
```

A aplicação sobe em `http://localhost:3000` e por padrão aponta para `http://localhost:8080`.

Se necessário, ajuste via variável:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
```


## Execução com Docker

Antes de subir a aplicação, garanta que o container do banco (`pg-lives`) esteja em execução.

### Build da imagem

```bash
docker build -t javadiv-app .
```

### Subir o container da aplicação

```bash
docker run -p 8080:8080 --name javadiv-container --network="host" javadiv-app
```

> Se optar por execução local sem Docker, mantenha o Java 21 instalado e configurado no terminal.


## Diagnóstico rápido: "campanha disparada com sucesso", mas e-mail não chega

Se a campanha foi iniciada, porém você não recebeu e-mail e não viu erro claro, valide nesta ordem:

1. **Status da campanha**
   - Consulte `GET /api/campaigns/{id}/status`.
   - Se retornar `sent=0`, `failed=0` e `pending=0`, a campanha finalizou sem destinatários elegíveis.

2. **Elegibilidade dos contatos**
   - O disparo só considera contatos com:
     - `consentimento=true`
     - `inscritoLives=true`
     - `unsubscribedAt=null`

3. **Logs de processamento (back-end)**
   - Agora o serviço registra logs estruturados de início e fim do disparo, incluindo total elegível e resumo final.
   - Em falhas de envio, também registra `campaignId`, `contactId`, `email` e motivo.

Exemplo de logs esperados:

```text
campaign_dispatch status=started campaignId=12 eligibleContacts=150
campaign_dispatch status=finished campaignId=12 processed=150 sent=148 failed=2
```

Exemplo quando não há base elegível:

```text
campaign_dispatch status=started campaignId=13 eligibleContacts=0
campaign_dispatch status=no_eligible_contacts campaignId=13
campaign_dispatch status=finished campaignId=13 processed=0 sent=0 failed=0
```
