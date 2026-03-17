<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white" alt="Node.js 20+">
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Playwright-1.58-2EAD33?logo=playwright&logoColor=white" alt="Playwright">
  <img src="https://img.shields.io/badge/Vitest-86_tests-6E9F18?logo=vitest&logoColor=white" alt="Vitest">
  <img src="https://img.shields.io/badge/License-MIT-blue" alt="MIT License">
  <img src="https://img.shields.io/badge/version-0.2.0-orange" alt="Version 0.2.0">
</p>

<h1 align="center">🔍 HTTP Traffic Observability</h1>

<p align="center">
  <strong>Ferramenta desktop/CLI para inspeção, auditoria e análise de tráfego HTTP em ambientes autorizados</strong>
</p>

<p align="center">
  <em>Observe. Sanitize. Analise. Exporte.</em>
</p>

---

## 📋 Índice

- [🎯 Visão Geral](#-visão-geral)
- [🧠 Mapa Mental](#-mapa-mental)
- [🏗️ Blueprint da Arquitetura](#️-blueprint-da-arquitetura)
- [⚡ Fluxo de Execução](#-fluxo-de-execução)
- [🔄 Pipeline de Processamento](#-pipeline-de-processamento)
- [🚀 Instalação](#-instalação)
- [💻 Comandos](#-comandos)
- [🖥️ TUI Interativa](#️-tui-interativa)
- [🛡️ Segurança & Sanitização](#️-segurança--sanitização)
- [🌊 Jornada de Domínio](#-jornada-de-domínio)
- [⚙️ Configuração](#️-configuração)
- [📂 Estrutura do Projeto](#-estrutura-do-projeto)
- [📦 Artefatos de Saída](#-artefatos-de-saída)
- [🧪 Testes](#-testes)
- [📝 Changelog](#-changelog)
- [🏛️ Decisões Arquiteturais](#️-decisões-arquiteturais)
- [⚠️ Limitações](#️-limitações)
- [🗺️ Próximos Passos](#️-próximos-passos)

---

## 🎯 Visão Geral

O projeto abre o **Chromium em modo visível**, permite **login manual**, observa requests **fetch/xhr**, aplica **sanitização obrigatória** antes de persistir qualquer dado e gera artefatos estruturados.

### Para que serve?

| Caso de uso | Descrição |
|:---:|---|
| 🔧 **Troubleshooting** | Diagnóstico legítimo de fluxos HTTP em ambientes dev/staging |
| 📊 **Documentação** | Geração automática de relatórios técnicos sanitizados |
| 🧪 **Testes** | Preparação de stubs de integração seguros |
| 🔍 **Auditoria** | Entendimento de fluxos funcionais ponta a ponta |
| 📝 **Integração** | Exportação de snippets para Axios, HTTPX, cURL e Fetch |

> 🔒 **Escopo de segurança**: esta ferramenta foi desenhada **apenas para uso autorizado**. Ela **não** faz bypass de autenticação, **não** persiste segredos brutos e **não** executa replay automático contra produção.

---

## 🧠 Mapa Mental

```mermaid
mindmap
  root((🔍 HTTP Traffic<br/>Observability))
    🌐 Navegador
      Chromium visível
      Login manual
      Sessão persistida por perfil
      Restauração automática de cookies
    📡 Captura
      Intercepta fetch/xhr
      Filtra por allowlist
      Ignora recursos estáticos
      Normaliza request/response
    🛡️ Sanitização
      Mascara tokens Bearer/Basic
      Redacta email, CPF, telefone
      Remove cookies/passwords
      Regras customizáveis via JSON
      RegExp compilado com cache
    🧮 Classificação
      Score LOW / MEDIUM / HIGH
      Keywords de relevância
      Detecção de burst
      Heurísticas de domínio
      Transições de estágio
    📦 Agrupamento
      Janela temporal configurável
      Rota ativa do navegador
      Semântica inferida
      Estágios de domínio
    💾 Persistência
      JSON estruturado
      Escrita atômica com rename
      Artefatos por sessão
    📤 Exportação
      Axios TypeScript
      HTTPX Python
      cURL Shell
      Fetch API nativo
      Relatório Markdown
    🖥️ Revisão
      TUI interativa
      Marcar importantes
      Adicionar notas
      Renomear flows
      Reagrupar heurísticas
    🧪 Testes
      86 testes unitários
      Vitest framework
      Cobertura dos módulos core
```

---

## 🏗️ Blueprint da Arquitetura

```mermaid
graph TB
    subgraph "🌐 Camada de Navegador"
        A[🖥️ Chromium Visível<br/><code>initBrowser.ts</code>] --> B[🍪 Session Manager<br/><code>sessionManager.ts</code>]
    end

    subgraph "📡 Camada de Rede"
        C[🎯 Interceptor<br/><code>interceptor.ts</code>] --> D[📋 Request Parser<br/><code>requestParser.ts</code>]
        D --> E[🛡️ Redactor<br/><code>redactor.ts</code>]
        E --> F[🧮 Classifier<br/><code>requestClassifier.ts</code>]
        F --> G[🧩 Domain Heuristics<br/><code>domainHeuristics.ts</code>]
        F --> H[📦 Flow Grouper<br/><code>flowGrouper.ts</code>]
    end

    subgraph "💾 Camada de Persistência"
        I[📁 File Manager<br/><code>fileManager.ts</code>]
        J[💿 Save JSON<br/><code>saveJson.ts</code>]
    end

    subgraph "📤 Camada de Exportação"
        K[📊 Axios Exporter]
        L[🐍 HTTPX Exporter]
        M[🖥️ cURL Exporter]
        N[🌐 Fetch Exporter]
        O[📝 Markdown Reporter]
        P[🔧 Shared Headers]
    end

    subgraph "🎮 Camada de Interface"
        Q[⌨️ CLI Commands<br/><code>commands.ts</code>]
        R[📂 Workspace<br/><code>workspace.ts</code>]
        S[🖥️ Review TUI<br/><code>reviewTui.ts</code>]
    end

    A --> C
    B --> A
    H --> I
    I --> J
    J --> K & L & M & N & O
    K & L & M & N --> P
    Q --> A & R & S
    R --> F & H & I

    style A fill:#4CAF50,color:#fff
    style E fill:#F44336,color:#fff
    style F fill:#FF9800,color:#fff
    style H fill:#2196F3,color:#fff
    style S fill:#9C27B0,color:#fff
```

---

## ⚡ Fluxo de Execução

```mermaid
sequenceDiagram
    participant U as 👤 Usuário
    participant CLI as ⌨️ CLI
    participant B as 🌐 Chromium
    participant I as 📡 Interceptor
    participant R as 🛡️ Redactor
    participant C as 🧮 Classifier
    participant G as 📦 Grouper
    participant S as 💾 Storage

    U->>CLI: http-observe start --target URL
    CLI->>B: Abre Chromium visível
    CLI->>B: Restaura sessão (se existir)
    B-->>U: Tela de login exibida

    U->>B: Login manual ✋

    loop Para cada request fetch/xhr
        B->>I: Request detectada
        I->>I: Filtra por allowlist e tipo
        I->>R: 🔒 Sanitiza headers + body
        R-->>I: Dados redactados
        I->>C: Classifica relevância
        C->>C: Score = método + keywords + domínio + burst
        C-->>I: LOW / MEDIUM / HIGH
        I->>G: Agrupa no flow ativo
        G-->>I: Flow ID atribuído
        I->>S: 💿 Persiste JSON sanitizado
        I-->>U: [HIGH] POST /api/proposal → 201
    end

    U->>CLI: Ctrl+C ⛔
    CLI->>B: Salva sessão
    CLI->>S: Gera relatório + exports
    CLI-->>U: ✅ Sessão finalizada
```

---

## 🔄 Pipeline de Processamento

Cada request HTTP passa por um pipeline rigoroso antes de ser persistida:

```mermaid
graph LR
    A["🌐 Request<br/>HTTP bruta"] --> B{"📋 Filtro<br/>fetch/xhr?"}
    B -->|❌ Não| Z["🗑️ Ignorada"]
    B -->|✅ Sim| C{"🔍 Allowlist<br/>domínio?"}
    C -->|❌ Fora| Z
    C -->|✅ Dentro| D{"🏷️ Tipo de<br/>recurso?"}
    D -->|imagem/font/etc| Z
    D -->|fetch/xhr| E["🛡️ SANITIZAÇÃO<br/>obrigatória"]

    E --> E1["🔑 Mascara tokens"]
    E --> E2["📧 Redacta PII"]
    E --> E3["🍪 Remove cookies"]
    E --> E4["⚙️ Regras custom"]

    E1 & E2 & E3 & E4 --> F["🧮 CLASSIFICAÇÃO"]

    F --> F1["📊 Score por método"]
    F --> F2["🔤 Keywords match"]
    F --> F3["🏢 Domain heuristics"]
    F --> F4["⚡ Burst detection"]

    F1 & F2 & F3 & F4 --> G{"📈 Score final"}

    G -->|"≥ 70"| H["🔴 HIGH"]
    G -->|"≥ 40"| I["🟡 MEDIUM"]
    G -->|"< 40"| J["🟢 LOW"]

    H & I & J --> K["📦 AGRUPAMENTO<br/>em flow"]
    K --> L["💾 Persistência<br/>JSON sanitizado"]

    style E fill:#F44336,color:#fff
    style F fill:#FF9800,color:#fff
    style K fill:#2196F3,color:#fff
    style L fill:#4CAF50,color:#fff
    style Z fill:#9E9E9E,color:#fff
```

---

## 🚀 Instalação

### 📋 Requisitos

| Requisito | Versão mínima |
|:---:|:---:|
| 🟢 Node.js | `20.0.0+` |
| 📦 npm | `10.0.0+` |
| 🔒 Ambiente | Autorizado (dev/staging/homolog) |

### 📥 Passos

```bash
# 1️⃣  Instalar dependências (inclui Chromium via Playwright)
npm install

# 2️⃣  Compilar o projeto
npm run build

# 3️⃣  Verificar tipo (opcional)
npm run check
```

> 💡 O `postinstall` executa `playwright install chromium` automaticamente.

---

## 💻 Comandos

### 🟢 `start` — Iniciar captura com navegador visível

```bash
npm run dev -- start --target https://seu-ambiente-autorizado.local --profile staging
```

| Flag | Descrição |
|---|---|
| `-t, --target <url>` | 🎯 URL alvo autorizada (**obrigatório**) |
| `-p, --profile <name>` | 👤 Perfil da sessão (default: `default`) |
| `--clear-session` | 🗑️ Limpa sessão antes de iniciar |
| `--debug` | 🐛 Ativa logs detalhados |

**Durante a execução:**

```
1️⃣  Chromium abre visível
2️⃣  Você faz login manualmente
3️⃣  Terminal mostra requests em tempo real
4️⃣  Ctrl+C para finalizar e persistir
```

**Console em tempo real:**

```
[HIGH] POST /api/proposal/create -> 201 in 428ms [flow: proposal-submit]
[MEDIUM] POST /api/simulation/run -> 200 in 312ms [flow: simulation]
[LOW] GET /api/config/bootstrap -> 200 in 89ms [flow: general-flow]
```

### 🔄 `analyze` — Reprocessar requests salvas

```bash
npm run dev -- analyze ./logs/requests

# Com marcação manual
npm run dev -- analyze ./logs/requests \
  --important <request-id> \
  --note <request-id>:submissao-critica \
  --rename-flow <flow-id>:proposal-confirmation
```

### 📤 `export` — Gerar stubs seguros

```bash
npm run dev -- export --format axios   # 📊 TypeScript com Axios
npm run dev -- export --format httpx   # 🐍 Python com HTTPX
npm run dev -- export --format curl    # 🖥️ Shell com cURL
npm run dev -- export --format fetch   # 🌐 TypeScript com Fetch API

# Filtrar por request específica
npm run dev -- export --format axios --request-id <id>
```

### 📝 `report` — Gerar relatório

```bash
npm run dev -- report
npm run dev -- report ./logs/requests
```

### 🗑️ `clear-session` — Limpar sessão persistida

```bash
npm run dev -- clear-session
npm run dev -- clear-session --profile staging
```

---

## 🖥️ TUI Interativa

```bash
npm run dev -- tui
npm run dev -- tui ./logs/requests
```

### ⌨️ Atalhos

| Tecla | Ação |
|:---:|---|
| `Tab` | 🔄 Alterna entre painel de flows e requests |
| `j` / `k` / `↑` / `↓` | 🔼🔽 Navega entre itens |
| `h` | ◀️ Vai para painel de flows |
| `l` | ▶️ Vai para painel de requests |
| `f` | 🔍 Cicla filtro: all → relevant → high |
| `i` | ⭐ Marca/desmarca request como importante |
| `n` | 📝 Adiciona nota à request selecionada |
| `r` | ✏️ Renomeia o flow selecionado |
| `g` | 🔄 Reaplica heurísticas de agrupamento |
| `e` | 📤 Exporta request em axios/httpx/curl/fetch |
| `s` / `w` | 💾 Salva alterações |
| `q` / `Esc` | 🚪 Sai da TUI |

---

## 🛡️ Segurança & Sanitização

A sanitização acontece **ANTES** de qualquer persistência. Nenhum dado bruto é salvo em disco.

### 🔒 O que é mascarado automaticamente

```mermaid
graph LR
    subgraph "🛡️ Mascaramento Automático"
        direction TB
        A["🔑 Authorization<br/>Bearer/Basic tokens"] --> R["***REDACTED***"]
        B["🍪 Cookie / Set-Cookie"] --> R
        C["🔐 CSRF tokens"] --> R
        D["🔑 Passwords"] --> R
        E["📧 Emails<br/><code>user@domain.com</code>"] --> R
        F["🪪 CPF<br/><code>123.456.789-00</code>"] --> R
        G["📱 Telefones<br/><code>+55 11 99999-9999</code>"] --> R
        H["🎫 JWT / Tokens longos"] --> R
    end

    style R fill:#F44336,color:#fff,font-weight:bold
```

### 📊 Antes vs Depois

```json
// ❌ ANTES (dado bruto - NUNCA é salvo)
{
  "authorization": "Bearer eyJhbGciOiJIUzI1NiJ9...",
  "cookie": "session=abc123; csrf=xyz789",
  "cpf": "123.456.789-00",
  "email": "joao@empresa.com"
}

// ✅ DEPOIS (dado sanitizado - o que é persistido)
{
  "authorization": "Bearer ***REDACTED***",
  "cookie": "***REDACTED***",
  "cpf": "***REDACTED***",
  "email": "***REDACTED***"
}
```

### ⚙️ Redaction customizada

Edite `config/redaction.json`:

```json
{
  "customSensitiveFields": ["customerDocument", "motherName"],
  "rules": [
    {
      "keyPattern": "customerDocument",
      "replacement": "***REDACTED***",
      "applyTo": "body"
    }
  ]
}
```

### ✅ O que a ferramenta faz

| | Descrição |
|:---:|---|
| ✅ | Captura tráfego de rede **autorizado** |
| ✅ | Persiste **somente dados redactados** |
| ✅ | Gera artefatos para QA, troubleshooting e integração |

### ❌ O que a ferramenta NÃO faz

| | Descrição |
|:---:|---|
| ❌ | Bypass de autenticação |
| ❌ | Evasão / stealth / fingerprint spoofing |
| ❌ | Replay automático de requests autenticadas |
| ❌ | Persistência de tokens/cookies reais |
| ❌ | Uso em produção sem autorização explícita |

---

## 🌊 Jornada de Domínio

O sistema reconhece estágios típicos de um fluxo de negócio e usa transições entre eles para melhorar a classificação:

```mermaid
graph LR
    A["🔐 Authentication<br/><code>login, auth, token</code>"] -->|45s| B["👤 Customer Lookup<br/><code>customer, search, cpf</code>"]
    B -->|30s| C["📊 Eligibility<br/><code>bootstrap, limit, offer</code>"]
    B -->|30s| D["🧮 Simulation<br/><code>simulate, quote, pricing</code>"]
    C -->|30s| D
    D -->|45s| E["📋 Proposal<br/><code>proposal, submit, save</code>"]
    E -->|60s| F["📎 Documents<br/><code>upload, attachment, kyc</code>"]
    E -->|60s| G["✅ Approval<br/><code>analysis, decision, review</code>"]
    F -->|90s| G
    G -->|120s| H["📝 Contract<br/><code>contract, signature, sign</code>"]
    H -->|90s| I["🎉 Finalization<br/><code>confirm, complete, success</code>"]

    style A fill:#FF9800,color:#fff
    style B fill:#2196F3,color:#fff
    style C fill:#00BCD4,color:#fff
    style D fill:#9C27B0,color:#fff
    style E fill:#F44336,color:#fff
    style F fill:#795548,color:#fff
    style G fill:#4CAF50,color:#fff
    style H fill:#607D8B,color:#fff
    style I fill:#8BC34A,color:#fff
```

> 💡 Os tempos nas setas indicam o `maxGapMs` para transições válidas. Requests dentro desse gap ganham score boost adicional.

---

## ⚙️ Configuração

### 📁 Arquivos de configuração

```
config/
├── 🔍 filters.json      → Controla allowlist e ruído
├── 🔤 keywords.json     → Keywords, thresholds e domínio
└── 🛡️ redaction.json    → Campos sensíveis e regras
```

### 🔍 `config/filters.json`

Controla **quais requests são capturadas**:

| Campo | Descrição |
|---|---|
| `allowlistDomains` | 🌐 Domínios permitidos (vazio = todos) |
| `ignoredResourceTypes` | 🚫 Tipos ignorados (image, font, etc.) |
| `ignoredUrlPatterns` | 🔇 Padrões de URL ignorados (analytics, etc.) |
| `includeGetKeywords` | 🔤 Keywords que tornam GET elegível |

### 🔤 `config/keywords.json`

Controla a **classificação e agrupamento**:

| Campo | Descrição |
|---|---|
| `relevanceKeywords` | 📊 Palavras-chave de relevância |
| `mediumThreshold` | 🟡 Score mínimo para MEDIUM (default: 40) |
| `highThreshold` | 🔴 Score mínimo para HIGH (default: 70) |
| `flowTimeWindowMs` | ⏱️ Janela temporal dos flows (default: 12s) |
| `domainFlowDefinitions` | 🏢 Definições de estágios do domínio |
| `domainSequenceRules` | 🔗 Regras de transição entre estágios |

### 🛡️ `config/redaction.json`

Controla a **sanitização de dados**:

| Campo | Descrição |
|---|---|
| `customSensitiveFields` | 🔒 Campos sensíveis adicionais |
| `rules` | 📏 Regras de redaction com padrão regex |

---

## 📂 Estrutura do Projeto

```
📁 http-traffic-observability/
│
├── 📄 README.md
├── 📄 package.json
├── 📄 tsconfig.json
├── 📄 vitest.config.ts
├── 📄 .gitignore
│
├── ⚙️ config/
│   ├── 🔍 filters.json
│   ├── 🔤 keywords.json
│   └── 🛡️ redaction.json
│
├── 📖 examples/
│   └── 🚀 minimal-run.sh
│
├── 🧪 tests/
│   ├── domainHeuristics.test.ts
│   ├── exporters.test.ts
│   ├── flowGrouper.test.ts
│   ├── redactor.test.ts
│   ├── requestClassifier.test.ts
│   └── utils.test.ts
│
├── 📊 logs/                         ← gerado em runtime
│   ├── 📁 sessions/
│   ├── 📁 requests/
│   ├── 📁 flows/
│   ├── 📁 reports/
│   └── 📁 exports/
│       ├── axios/
│       ├── httpx/
│       ├── curl/
│       ├── fetch/
│       └── markdown/
│
└── 🔧 src/
    ├── 📄 index.ts                  ← Entry point
    │
    ├── 🌐 browser/
    │   ├── initBrowser.ts           ← Chromium headless:false
    │   └── sessionManager.ts        ← storageState por perfil
    │
    ├── ⌨️ cli/
    │   ├── args.ts                  ← Parsing de argumentos
    │   ├── commands.ts              ← Orquestração dos comandos
    │   └── workspace.ts             ← Leitura e reagrupamento offline
    │
    ├── ⚙️ config/
    │   ├── defaultConfig.ts         ← Valores default e merge
    │   └── schema.ts                ← Validação Zod
    │
    ├── 📤 exporters/
    │   ├── axiosExporter.ts         ← Snippets Axios
    │   ├── curlExporter.ts          ← Snippets cURL
    │   ├── fetchExporter.ts         ← Snippets Fetch API
    │   ├── httpxExporter.ts         ← Snippets HTTPX
    │   ├── markdownReporter.ts      ← Relatório Markdown
    │   └── shared.ts                ← Headers compartilhados
    │
    ├── 📡 network/
    │   ├── domainHeuristics.ts      ← Reconhecimento de domínio
    │   ├── flowGrouper.ts           ← Agrupamento em flows
    │   ├── interceptor.ts           ← Interceptação em runtime
    │   ├── redactor.ts              ← Sanitização centralizada
    │   ├── requestClassifier.ts     ← Scoring LOW/MEDIUM/HIGH
    │   └── requestParser.ts         ← Normalização de requests
    │
    ├── 💾 storage/
    │   ├── fileManager.ts           ← Diretórios e leitura
    │   └── saveJson.ts              ← Escrita atômica
    │
    ├── 🖥️ tui/
    │   └── reviewTui.ts             ← Interface interativa
    │
    ├── 📋 types/
    │   ├── config.ts                ← Tipos de configuração
    │   ├── flow.ts                  ← Tipos de flow
    │   └── network.ts               ← Tipos de rede
    │
    └── 🔧 utils/
        ├── errors.ts                ← AppError + toError
        ├── json.ts                  ← Parse, stringify, truncate
        ├── logger.ts                ← Logger com níveis
        └── time.ts                  ← Formatação de tempo
```

---

## 📦 Artefatos de Saída

| Artefato | Caminho | Formato |
|:---:|---|:---:|
| 📋 Requests | `logs/requests/request-<id>.json` | JSON |
| 📦 Flows | `logs/flows/flow-<session>-<N>-<nome>.json` | JSON |
| 📊 Relatório | `logs/reports/session-<timestamp>.json` | JSON |
| 📝 Sumário | `logs/exports/markdown/session-<timestamp>.md` | Markdown |
| 📊 Axios | `logs/exports/axios/request-<id>.ts` | TypeScript |
| 🐍 HTTPX | `logs/exports/httpx/request-<id>.py` | Python |
| 🖥️ cURL | `logs/exports/curl/request-<id>.sh` | Shell |
| 🌐 Fetch | `logs/exports/fetch/request-<id>.ts` | TypeScript |
| 🍪 Sessão | `sessions/<profile>.json` | storageState |

### 📊 O que contém o relatório?

| Seção | Descrição |
|---|---|
| 📈 Total de requests | Observadas e relevantes |
| 🔝 Top endpoints | Mais frequentes e mutáveis |
| 📦 Flows detectados | ID, nome e contagem |
| 🔴 Requests HIGH | Método, path, status e flow |
| ❌ Falhas HTTP | Status 4xx/5xx com erro |
| 🎭 Ações inferidas | Ações de usuário detectadas |
| 📁 Arquivos gerados | Lista completa de artefatos |

---

## 🧪 Testes

O projeto conta com **86 testes unitários** escritos com [Vitest](https://vitest.dev/):

```bash
npm test              # 🧪 Roda todos os testes
npm run test:watch    # 👀 Modo watch
npm run test:coverage # 📊 Relatório de cobertura
```

### 📊 Cobertura por módulo

| Módulo | Testes | Áreas cobertas |
|---|:---:|---|
| 🛡️ `redactor.ts` | 15 | Headers, query, body, truncamento, PII patterns |
| 🧮 `requestClassifier.ts` | 9 | Scoring, keywords, domain, burst, sequência |
| 📦 `flowGrouper.ts` | 9 | Agrupamento, estatísticas, relevância, reset |
| 🧩 `domainHeuristics.ts` | 15 | Detecção, sequência, ranking, lookup |
| 🔧 `utils/*.ts` | 33 | JSON, time, errors, args |
| 📤 `exporters/shared.ts` | 5 | Builder de headers |
| | **86** | |

---

## 📝 Changelog

### 🏷️ v0.2.0

#### 🐛 Correções
- **Axios exporter**: requests GET não enviam mais body como segundo argumento
- **HTTPX exporter**: conversão de literais Python mais robusta

#### ✨ Novos recursos
- **Fetch API exporter**: novo formato `--format fetch` usando `fetch()` nativo
- **86 testes unitários**: cobertura abrangente com Vitest
- **Cleanup automático**: interceptor limpa requests pendentes após 120s

#### ⚡ Melhorias
- **Dependências fixadas**: `latest` → versões semânticas específicas
- **Cache de RegExp**: regras compiladas uma vez no construtor
- **Headers compartilhados**: `buildExportHeaders` extraído para módulo DRY
- **Scripts de teste**: `test`, `test:watch`, `test:coverage`

---

## 🏛️ Decisões Arquiteturais

### 🎯 Regras simples primeiro

> A classificação usa **heurísticas transparentes** em vez de inferência opaca. Trade-off: menos sofisticação estatística, mais previsibilidade e facilidade de ajuste por arquivo.

### 🛡️ Redação centralizada

> A sanitização fica concentrada em `network/redactor.ts` com **RegExp compilado em cache**. Reduz o risco de um módulo futuro esquecer de mascarar campos antes da persistência.

### 👤 Sessão por perfil

> O `storageState` é salvo por perfil (`default`, `staging`, `qa`). Trade-off: mais arquivos em `/sessions`, mas melhor isolamento entre ambientes.

### 📦 Agrupamento heurístico

> Flows inferidos por: **janela temporal** + **rota ativa** + **keywords** + **estágios de domínio**. Melhora a leitura de jornadas como: busca → simulação → proposta → documentos → aprovação → contrato.

---

## ⚠️ Limitações

| Limitação | Detalhe |
|---|---|
| 🍪 Expiração de sessão | Heurística baseada em cookies persistidos |
| 🔗 Campo `initiator` | Aproximado a partir de frame/page |
| 🎭 Ações do usuário | Inferidas, não rastreadas do DOM |
| 📦 Respostas binárias | Resumidas, não persistidas integralmente |
| 🔍 Requests GET | Capturadas apenas com keywords configuradas |
| 🖥️ TUI | Requer terminal TTY real |

---

## 🗺️ Próximos Passos

```mermaid
graph LR
    A["📍 Atual<br/>v0.2.0"] --> B["🔮 Navegação DOM<br/>Eventos de formulário"]
    A --> C["📋 OpenAPI Export<br/>Spec a partir dos artefatos"]
    A --> D["📸 Session Snapshots<br/>Comparar ambientes"]
    A --> E["🧪 E2E Tests<br/>Playwright fixtures"]

    style A fill:#4CAF50,color:#fff,font-weight:bold
    style B fill:#2196F3,color:#fff
    style C fill:#FF9800,color:#fff
    style D fill:#9C27B0,color:#fff
    style E fill:#F44336,color:#fff
```

1. 🔮 Enriquecer inferência de fluxo com eventos explícitos de navegação e formulário
2. 📋 Adicionar suporte opcional a exportação OpenAPI-like a partir dos artefatos sanitizados
3. 📸 Criar snapshots de sessão para comparar ambientes homolog/staging
4. 🧪 Adicionar testes de integração end-to-end com Playwright fixtures

---

## 🚀 Exemplo Mínimo

```bash
chmod +x ./examples/minimal-run.sh
./examples/minimal-run.sh
```

O script:
1. 📦 Instala dependências
2. 🔨 Compila o projeto
3. 🌐 Abre o Chromium visível em `https://example.com`

---

## ✅ Critérios de Aceite

| # | Critério | Status |
|:---:|---|:---:|
| 1 | Compilação TypeScript estrita | ✅ |
| 2 | CLI com todos os comandos | ✅ |
| 3 | Chromium visível via Playwright | ✅ |
| 4 | Interceptação de fetch/xhr relevantes | ✅ |
| 5 | Persistência estruturada em JSON | ✅ |
| 6 | Mascaramento obrigatório antes de salvar | ✅ |
| 7 | Agrupamento por fluxo funcional | ✅ |
| 8 | Exportadores seguros (5 formatos) | ✅ |
| 9 | 86 testes unitários automatizados | ✅ |
| 10 | Versões de dependências fixadas | ✅ |
| 11 | README completo com diagramas | ✅ |
| 12 | Exemplo mínimo executável | ✅ |

---

<p align="center">
  Feito com 🔍 para observabilidade segura de tráfego HTTP
</p>
