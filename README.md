# HTTP Traffic Observability

Ferramenta desktop/CLI em **Node.js + TypeScript + Playwright** para **inspeção, auditoria e análise de tráfego HTTP** de aplicações web em **ambientes autorizados** de desenvolvimento, homologação ou staging.

## Visão geral

O projeto abre o Chromium em modo visível, permite **login manual**, observa requests **fetch/xhr**, aplica **sanitização obrigatória** antes de persistir qualquer dado e gera artefatos estruturados para:

- troubleshooting legítimo;
- entendimento de fluxos funcionais;
- documentação técnica;
- preparação de testes;
- geração segura de stubs de integração.

> Escopo de segurança: esta ferramenta foi desenhada apenas para uso autorizado. Ela **não** faz bypass de autenticação, **não** persiste segredos brutos e **não** executa replay automático contra produção.

## Changelog (v0.2.0)

### Correções
- **Axios exporter**: corrigido bug onde requests GET enviavam body como segundo argumento (comportamento incorreto para `axios.get`)
- **HTTPX exporter**: conversão de literais Python mais robusta usando replacer de JSON nativo

### Novos recursos
- **Fetch API exporter**: novo formato de exportação usando `fetch()` nativo (`--format fetch`)
- **86 testes unitários**: cobertura abrangente com Vitest para redactor, classifier, flowGrouper, domainHeuristics, utils e exporters
- **Cleanup de requests pendentes**: interceptor agora limpa automaticamente requests que ficam pendentes por mais de 120s

### Melhorias
- **Versões de dependências fixadas**: substituídas todas as referências `latest` por versões semânticas específicas
- **Cache de RegExp no redactor**: regras de redação são compiladas uma vez no construtor em vez de recompilar a cada verificação
- **Headers de exportação compartilhados**: lógica `buildExportHeaders` extraída para módulo compartilhado (DRY entre exporters)
- **Scripts de teste**: adicionados `test`, `test:watch` e `test:coverage` ao package.json

## Árvore de arquivos

```text
.
├── README.md
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .gitignore
├── config/
│   ├── filters.json
│   ├── keywords.json
│   └── redaction.json
├── examples/
│   └── minimal-run.sh
├── tests/
│   ├── domainHeuristics.test.ts
│   ├── exporters.test.ts
│   ├── flowGrouper.test.ts
│   ├── redactor.test.ts
│   ├── requestClassifier.test.ts
│   └── utils.test.ts
├── logs/
│   ├── sessions/
│   ├── requests/
│   ├── flows/
│   ├── reports/
│   └── exports/
│       ├── axios/
│       ├── httpx/
│       ├── curl/
│       ├── fetch/
│       └── markdown/
├── sessions/
└── src/
    ├── browser/
    │   ├── initBrowser.ts
    │   └── sessionManager.ts
    ├── cli/
    │   ├── args.ts
    │   ├── commands.ts
    │   └── workspace.ts
    ├── config/
    │   ├── defaultConfig.ts
    │   └── schema.ts
    ├── exporters/
    │   ├── axiosExporter.ts
    │   ├── curlExporter.ts
    │   ├── fetchExporter.ts
    │   ├── httpxExporter.ts
    │   ├── markdownReporter.ts
    │   └── shared.ts
    ├── network/
    │   ├── domainHeuristics.ts
    │   ├── flowGrouper.ts
    │   ├── interceptor.ts
    │   ├── redactor.ts
    │   ├── requestClassifier.ts
    │   └── requestParser.ts
    ├── storage/
    │   ├── fileManager.ts
    │   └── saveJson.ts
    ├── tui/
    │   └── reviewTui.ts
    ├── types/
    │   ├── config.ts
    │   ├── flow.ts
    │   └── network.ts
    ├── utils/
    │   ├── errors.ts
    │   ├── json.ts
    │   ├── logger.ts
    │   └── time.ts
    └── index.ts
```

## Arquitetura

### 1. Camada de navegador
- `browser/initBrowser.ts`: sobe o Chromium com `headless: false`.
- `browser/sessionManager.ts`: restaura/salva `storageState` em `/sessions` e detecta expiração básica por cookies persistidos.

### 2. Camada de rede
- `network/requestParser.ts`: filtra fetch/xhr relevantes, normaliza request/response e extrai dados estruturados.
- `network/redactor.ts`: aplica mascaramento obrigatório antes de qualquer persistência.
- `network/requestClassifier.ts`: faz scoring LOW/MEDIUM/HIGH configurável por heurística.
- `network/domainHeuristics.ts`: adiciona reconhecimento explícito do domínio de cliente/simulação/proposta/documentos/contrato/finalização.
- `network/flowGrouper.ts`: agrupa requests por janela temporal, rota ativa e semântica inferida.
- `network/interceptor.ts`: conecta tudo em runtime e imprime feedback no terminal em tempo real.

### 3. Camada de persistência
- `storage/saveJson.ts`: grava JSON/texto com escrita temporária e rename.
- `storage/fileManager.ts`: garante diretórios, leitura de artefatos e suporte a caminhos.

### 4. Camada de exportação e relatório
- `exporters/*.ts`: gera snippets seguros para Axios, HTTPX, cURL, Fetch API e sumário Markdown.
- `exporters/shared.ts`: lógica compartilhada de construção de headers para exportação.

### 5. Camada de CLI
- `cli/commands.ts`: orquestra `start`, `analyze`, `export`, `report` e `clear-session`.
- `cli/workspace.ts`: centraliza leitura, reagrupamento, ajustes manuais e persistência offline.
- `tui/reviewTui.ts`: TUI interativa para revisão e curadoria dos artefatos.

## Instalação

### Requisitos
- Node.js 20+
- npm 10+
- ambiente autorizado para observar a aplicação

### Passos

```bash
npm install
npm run build
```

O `postinstall` executa `playwright install chromium` para garantir o browser do Playwright.

## Comandos

### Iniciar captura com navegador visível

```bash
npm run dev -- start --target https://seu-ambiente-autorizado.local --profile staging
```

Opções úteis:

```bash
npm run dev -- start --target https://seu-ambiente.local --debug
npm run dev -- start --target https://seu-ambiente.local --clear-session
npm run dev -- start --target https://seu-ambiente.local --profile qa
```

Durante a execução:
1. o Chromium abre visível;
2. você faz login manualmente;
3. o terminal mostra requests relevantes em tempo real;
4. finalize com `Ctrl+C` para persistir sessão e artefatos.

### Analisar requests já salvas

```bash
npm run dev -- analyze ./logs/requests
```

Com marcação manual:

```bash
npm run dev -- analyze ./logs/requests   --important 11111111-1111-1111-1111-111111111111   --note 11111111-1111-1111-1111-111111111111:submissao-critica   --rename-flow flow-2-proposal-submit:proposal-confirmation
```

### Exportar stubs seguros

```bash
npm run dev -- export --format axios
npm run dev -- export --format httpx
npm run dev -- export --format curl
npm run dev -- export --format fetch
```

### Abrir a TUI interativa

```bash
npm run dev -- tui
npm run dev -- tui ./logs/requests
```

Atalhos principais:

- `Tab`: alterna entre painel de flows e requests
- `j` / `k` ou setas: navega
- `i`: marca/desmarca request como importante
- `n`: adiciona nota à request selecionada
- `r`: renomeia o flow selecionado
- `g`: reaplica as heurísticas refinadas de agrupamento
- `e`: exporta a request atual em axios/httpx/curl/fetch
- `s`: salva os artefatos revisados
- `q`: sai da TUI

Filtrando por request específica:

```bash
npm run dev -- export --format axios --request-id 11111111-1111-1111-1111-111111111111
```

### Gerar relatório

```bash
npm run dev -- report
npm run dev -- report ./logs/requests
```

### Limpar sessão persistida

```bash
npm run dev -- clear-session
npm run dev -- clear-session --profile staging
```

## Estrutura de saída

A aplicação gera artefatos sanitizados em:

- `logs/requests/request-<id>.json`
- `logs/flows/flow-<session>-<ordem>-<nome>.json`
- `logs/reports/session-<timestamp>.json`
- `logs/exports/markdown/session-<timestamp>.md`
- `logs/exports/axios/request-<id>.ts`
- `logs/exports/httpx/request-<id>.py`
- `logs/exports/curl/request-<id>.sh`
- `logs/exports/fetch/request-<id>.ts`
- `logs/sessions/session-<timestamp>.json`
- `sessions/<profile>.json` para `storageState`

## Console em tempo real

Formato padrão:

```text
[HIGH] POST /api/proposal/create -> 201 in 428ms [flow: proposal-submit]
```

Com `--debug`, o terminal também mostra:
- preview sanitizado do payload;
- preview sanitizado da resposta;
- razões do score;
- motivos de ignore para requests filtradas.

## Política de segurança

### O que a ferramenta faz
- captura tráfego de rede autorizado;
- persiste somente dados redigidos;
- gera artefatos para QA, troubleshooting e integração legítima.

### O que a ferramenta não faz
- bypass de autenticação;
- evasão/stealth/fingerprint spoofing;
- replay automático de requests autenticadas;
- persistência de tokens/cookies reais em JSON;
- uso em produção sem autorização explícita.

## Como funciona a sanitização

A sanitização acontece **antes** de salvar qualquer request/response.

Itens mascarados por padrão:
- `Authorization`
- `Cookie`
- `Set-Cookie`
- `csrf`
- `token`
- `password`
- `cpf`
- `email`
- telefones detectáveis
- padrões típicos de bearer/basic token

Exemplos:

```json
{
  "authorization": "Bearer ***REDACTED***",
  "cookie": "***REDACTED***",
  "cpf": "***REDACTED***"
}
```

### Configurando redaction customizada

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

## Configuração

### `config/filters.json`
Controla allowlist e ruído irrelevante.

### `config/keywords.json`
Controla palavras-chave de relevância, thresholds, janela temporal e as heurísticas do domínio.

O arquivo agora também define:
- `domainFlowDefinitions`
- `domainSequenceRules`

Essas estruturas modelam um domínio típico de crédito/proposta com estágios como:

- `authentication`
- `customer_lookup`
- `eligibility_bootstrap`
- `simulation`
- `proposal_submission`
- `document_upload`
- `approval_review`
- `contract_signature`
- `finalization`

As transições configuradas ajudam a:
- aumentar score de requests coerentes com a jornada funcional;
- separar fluxos por etapa de negócio;
- tornar a TUI mais útil para revisão de ponta a ponta.

### `config/redaction.json`
Controla campos sensíveis e regras adicionais de mascaramento.

## Como usar em ambiente autorizado

1. aponte para um domínio controlado por você;
2. faça login manualmente;
3. execute apenas em dev/homolog/staging;
4. revise `filters.json` e `redaction.json` antes de capturar;
5. trate os artefatos gerados como material técnico sanitizado.

## Como interpretar os relatórios

O sumário JSON/Markdown traz:
- total de requests observadas;
- total de requests relevantes;
- endpoints mais frequentes;
- endpoints mutáveis mais frequentes;
- fluxos detectados;
- requests HIGH;
- falhas HTTP;
- ações de usuário inferidas;
- lista de arquivos gerados.

## Exemplo mínimo executável

Arquivo: `examples/minimal-run.sh`

```bash
chmod +x ./examples/minimal-run.sh
./examples/minimal-run.sh
```

Esse script:
1. instala dependências;
2. compila o projeto;
3. abre o Chromium visível apontando para `https://example.com`.

## Decisões arquiteturais

### Regras simples primeiro
A classificação usa heurísticas transparentes em vez de inferência opaca. O trade-off é perder sofisticação estatística, mas ganhar previsibilidade e facilidade de ajuste por arquivo.

### Redação centralizada
A sanitização fica concentrada em `network/redactor.ts`. Isso reduz o risco de um módulo futuro esquecer de mascarar campos antes da persistência.

### Sessão por perfil
O `storageState` é salvo por perfil (`default`, `staging`, `qa` etc.). O trade-off é manter arquivos extras em `/sessions`, mas melhora isolamento entre ambientes autorizados.

### Agrupamento heurístico
Os fluxos são inferidos por janela temporal + rota + palavras-chave + estágios de domínio. Isso melhora bastante a leitura de jornadas como busca de cliente -> simulação -> proposta -> documentos -> aprovação -> contrato.

## Limitações conhecidas

- detecção de expiração de sessão é heurística e baseada em cookies persistidos;
- o campo `initiator` é aproximado a partir de frame/page;
- ações manuais do usuário são inferidas, não rastreadas diretamente do DOM;
- respostas binárias são resumidas em vez de persistidas integralmente;
- `GET` é capturada apenas quando combina com palavras-chave configuradas;
- a TUI depende de um terminal TTY real para funcionamento interativo.

## Critérios de aceite cobertos

- compilação TypeScript estrita;
- CLI com os comandos solicitados;
- Chromium visível via Playwright;
- interceptação de fetch/xhr relevantes;
- persistência estruturada em JSON;
- mascaramento obrigatório antes de salvar;
- agrupamento por fluxo funcional;
- exportadores seguros (Axios, HTTPX, cURL, Fetch, Markdown);
- 86 testes unitários automatizados com Vitest;
- versões de dependências fixadas;
- README completo;
- exemplo mínimo executável.

## Testes

O projeto conta com **86 testes unitários** escritos com [Vitest](https://vitest.dev/):

```bash
npm test              # roda todos os testes uma vez
npm run test:watch    # roda em modo watch
npm run test:coverage # roda com relatório de cobertura
```

Módulos com cobertura de teste:
- `network/redactor.ts`: sanitização de headers, query, body, truncamento, padrões PII
- `network/requestClassifier.ts`: scoring, keywords, domain match, burst, sequência
- `network/flowGrouper.ts`: agrupamento temporal, estatísticas, relevância, reset
- `network/domainHeuristics.ts`: detecção de domínio, sequência, ranking
- `utils/*.ts`: todas as funções utilitárias
- `exporters/shared.ts`: builder de headers de exportação
- `cli/args.ts`: parsing de argumentos

## Próximos passos recomendados

1. enriquecer inferência de fluxo com eventos explícitos de navegação e formulário;
2. adicionar suporte opcional a exportação OpenAPI-like a partir dos artefatos sanitizados;
3. criar snapshots de sessão para comparar ambientes homolog/staging;
4. adicionar testes de integração end-to-end com Playwright fixtures.
