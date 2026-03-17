import { describe, it, expect } from "vitest";
import { detectDomainMatches, findPrimaryDomainMatch, findSequenceRule, findDomainDefinitionById, summarizeDomainReason } from "../src/network/domainHeuristics";
import type { AppConfig, DomainFlowDefinition } from "../src/types/config";
import type { RequestRecord } from "../src/types/network";

const simulationDef: DomainFlowDefinition = {
  id: "simulation",
  name: "simulation",
  stage: "simulation",
  urlPatterns: ["simulation", "simulate", "quote"],
  requestKeywords: ["simulation", "amount"],
  responseKeywords: ["installment", "rate"],
  routeKeywords: ["/simulation", "/quote"],
  actionLabel: "credit simulation",
  baseScoreBoost: 22,
  mutableScoreBoost: 8,
  successScoreBoost: 10,
  startNewFlowOnMatch: true
};

const loginDef: DomainFlowDefinition = {
  id: "login",
  name: "login",
  stage: "authentication",
  urlPatterns: ["login", "auth"],
  requestKeywords: ["login", "password"],
  responseKeywords: ["authenticated"],
  routeKeywords: ["/login", "/auth"],
  actionLabel: "manual authentication",
  baseScoreBoost: 18,
  mutableScoreBoost: 8,
  successScoreBoost: 10,
  startNewFlowOnMatch: true
};

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    outputDirectory: "/tmp/logs",
    sessionDirectory: "/tmp/sessions",
    sessionFile: "/tmp/sessions/default.json",
    persistSession: false,
    clearSessionOnStart: false,
    debug: false,
    allowlistDomains: [],
    ignoredResourceTypes: [],
    ignoredUrlPatterns: [],
    includeGetKeywords: [],
    relevanceKeywords: [],
    mediumThreshold: 40,
    highThreshold: 70,
    flowTimeWindowMs: 12000,
    requestBodyPreviewLimit: 512,
    responseBodyPreviewLimit: 768,
    maxBodyBytesToStore: 16384,
    customSensitiveFields: [],
    redactionRules: [],
    domainFlowDefinitions: [loginDef, simulationDef],
    domainSequenceRules: [
      { fromStage: "authentication", toStage: "simulation", maxGapMs: 30000, scoreBoost: 10 }
    ],
    exportFormats: ["axios"],
    ...overrides
  };
}

function makeRecord(overrides: Partial<RequestRecord> & { request?: Partial<RequestRecord["request"]>; response?: Partial<NonNullable<RequestRecord["response"]>> }): RequestRecord {
  return {
    relevance: "LOW",
    scoreValue: 0,
    scoreReasons: [],
    relevant: false,
    domainSignals: [],
    autoObservations: [],
    manuallyImportant: false,
    notes: [],
    ...overrides,
    request: {
      id: "test-id",
      timestamp: new Date().toISOString(),
      sequence: 1,
      method: "GET",
      url: "https://api.example.com/data",
      pathname: "/data",
      queryParams: {},
      headers: {},
      body: null,
      bodyPreview: "",
      bodyTruncated: false,
      resourceType: "fetch",
      ...overrides.request
    },
    response: overrides.response ? {
      status: 200,
      headers: {},
      body: null,
      bodyPreview: "",
      bodyTruncated: false,
      durationMs: 100,
      ok: true,
      redirected: false,
      ...overrides.response
    } : undefined
  };
}

describe("domainHeuristics", () => {
  describe("detectDomainMatches", () => {
    it("deve detectar match para simulation URL", () => {
      const config = makeConfig();
      const record = makeRecord({
        request: { url: "https://api.example.com/simulation/run", pathname: "/simulation/run" },
        response: { status: 200, bodyPreview: "installment data" }
      });

      const matches = detectDomainMatches(record, config);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]!.definition.id).toBe("simulation");
    });

    it("deve retornar lista vazia se nenhum domínio combina", () => {
      const config = makeConfig();
      const record = makeRecord({
        request: { url: "https://api.example.com/unknown/path", pathname: "/unknown/path" }
      });

      const matches = detectDomainMatches(record, config);
      expect(matches).toHaveLength(0);
    });

    it("deve aplicar score boost extra para métodos mutáveis", () => {
      const config = makeConfig();
      const getRecord = makeRecord({
        request: { method: "GET", url: "https://api.example.com/simulation", pathname: "/simulation" }
      });
      const postRecord = makeRecord({
        request: { method: "POST", url: "https://api.example.com/simulation", pathname: "/simulation" }
      });

      const getMatches = detectDomainMatches(getRecord, config);
      const postMatches = detectDomainMatches(postRecord, config);

      expect(postMatches[0]!.scoreBoost).toBeGreaterThan(getMatches[0]!.scoreBoost);
    });

    it("deve aplicar score boost extra para respostas de sucesso", () => {
      const config = makeConfig();
      const successRecord = makeRecord({
        request: { url: "https://api.example.com/simulation", pathname: "/simulation" },
        response: { status: 200 }
      });
      const failRecord = makeRecord({
        request: { url: "https://api.example.com/simulation", pathname: "/simulation" },
        response: { status: 500 }
      });

      const successMatches = detectDomainMatches(successRecord, config);
      const failMatches = detectDomainMatches(failRecord, config);

      expect(successMatches[0]!.scoreBoost).toBeGreaterThan(failMatches[0]!.scoreBoost);
    });

    it("deve ordenar matches por scoreBoost decrescente", () => {
      const config = makeConfig();
      const record = makeRecord({
        request: {
          url: "https://api.example.com/login/simulation",
          pathname: "/login/simulation",
          bodyPreview: "simulation amount login"
        },
        response: { status: 200, bodyPreview: "installment authenticated" }
      });

      const matches = detectDomainMatches(record, config);
      for (let i = 1; i < matches.length; i++) {
        expect(matches[i - 1]!.scoreBoost).toBeGreaterThanOrEqual(matches[i]!.scoreBoost);
      }
    });
  });

  describe("findPrimaryDomainMatch", () => {
    it("deve retornar o match com maior score", () => {
      const config = makeConfig();
      const record = makeRecord({
        request: { url: "https://api.example.com/simulation/calculate", pathname: "/simulation/calculate", bodyPreview: "simulation amount" },
        response: { status: 200, bodyPreview: "installment rate" }
      });

      const primary = findPrimaryDomainMatch(record, config);
      expect(primary).toBeDefined();
      expect(primary!.definition.id).toBe("simulation");
    });

    it("deve retornar undefined quando não há match", () => {
      const config = makeConfig();
      const record = makeRecord({
        request: { url: "https://api.example.com/random", pathname: "/random" }
      });

      expect(findPrimaryDomainMatch(record, config)).toBeUndefined();
    });
  });

  describe("findDomainDefinitionById", () => {
    it("deve encontrar definição por ID", () => {
      const config = makeConfig();
      const def = findDomainDefinitionById(config, "simulation");
      expect(def).toBeDefined();
      expect(def!.name).toBe("simulation");
    });

    it("deve retornar undefined para ID inexistente", () => {
      const config = makeConfig();
      expect(findDomainDefinitionById(config, "nonexistent")).toBeUndefined();
    });

    it("deve retornar undefined para ID undefined", () => {
      const config = makeConfig();
      expect(findDomainDefinitionById(config, undefined)).toBeUndefined();
    });
  });

  describe("findSequenceRule", () => {
    it("deve encontrar regra de sequência válida", () => {
      const config = makeConfig();
      const rule = findSequenceRule("authentication", "simulation", 5000, config);
      expect(rule).toBeDefined();
      expect(rule!.scoreBoost).toBe(10);
    });

    it("deve retornar undefined quando gap excede maxGapMs", () => {
      const config = makeConfig();
      expect(findSequenceRule("authentication", "simulation", 50000, config)).toBeUndefined();
    });

    it("deve retornar undefined para sequência não configurada", () => {
      const config = makeConfig();
      expect(findSequenceRule("simulation", "authentication", 5000, config)).toBeUndefined();
    });

    it("deve retornar undefined quando stages são undefined", () => {
      const config = makeConfig();
      expect(findSequenceRule(undefined, "simulation", 5000, config)).toBeUndefined();
      expect(findSequenceRule("authentication", undefined, 5000, config)).toBeUndefined();
    });
  });

  describe("summarizeDomainReason", () => {
    it("deve gerar resumo com sinais limitados", () => {
      const match = {
        definition: simulationDef,
        matchedUrlPatterns: ["simulation"],
        matchedRequestKeywords: ["amount"],
        matchedResponseKeywords: ["installment", "rate"],
        matchedRouteKeywords: ["/simulation"],
        signals: ["url:simulation", "request:amount", "response:installment", "response:rate", "route:/simulation"],
        scoreBoost: 50
      };

      const summary = summarizeDomainReason(match);
      expect(summary).toContain("simulation");
      const signalsInSummary = summary.split(",").length;
      expect(signalsInSummary).toBeLessThanOrEqual(4);
    });
  });
});
