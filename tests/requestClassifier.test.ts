import { describe, it, expect } from "vitest";
import { RequestClassifier } from "../src/network/requestClassifier";
import type { AppConfig } from "../src/types/config";
import type { RequestRecord } from "../src/types/network";

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
    relevanceKeywords: ["create", "submit", "proposal", "simulation"],
    mediumThreshold: 40,
    highThreshold: 70,
    flowTimeWindowMs: 12000,
    requestBodyPreviewLimit: 512,
    responseBodyPreviewLimit: 768,
    maxBodyBytesToStore: 16384,
    customSensitiveFields: [],
    redactionRules: [],
    domainFlowDefinitions: [
      {
        id: "simulation",
        name: "simulation",
        stage: "simulation",
        urlPatterns: ["simulation", "simulate"],
        requestKeywords: ["simulation"],
        responseKeywords: ["installment"],
        routeKeywords: ["/simulation"],
        actionLabel: "credit simulation",
        baseScoreBoost: 22,
        mutableScoreBoost: 8,
        successScoreBoost: 10,
        startNewFlowOnMatch: true
      }
    ],
    domainSequenceRules: [
      { fromStage: "customer_lookup", toStage: "simulation", maxGapMs: 30000, scoreBoost: 10 }
    ],
    exportFormats: ["axios"],
    ...overrides
  };
}

function makeRecord(overrides: Partial<RequestRecord> & { request: Partial<RequestRecord["request"]>; response?: Partial<NonNullable<RequestRecord["response"]>> }): RequestRecord {
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

describe("RequestClassifier", () => {
  it("deve classificar POST como mais relevante que GET", () => {
    const classifier = new RequestClassifier(makeConfig());

    const postRecord = makeRecord({
      request: { method: "POST", url: "https://api.example.com/data", pathname: "/data" },
      response: { status: 200 }
    });
    const getRecord = makeRecord({
      request: { method: "GET", url: "https://api.example.com/data", pathname: "/data" },
      response: { status: 200 }
    });

    const postResult = classifier.classify(postRecord, []);
    const getResult = classifier.classify(getRecord, []);

    expect(postResult.score).toBeGreaterThan(getResult.score);
  });

  it("deve atribuir score MEDIUM para POST com resposta de sucesso", () => {
    const classifier = new RequestClassifier(makeConfig());

    const record = makeRecord({
      request: { method: "POST", url: "https://api.example.com/submit", pathname: "/submit", bodyPreview: "x".repeat(150) },
      response: { status: 201, contentType: "application/json" }
    });

    const result = classifier.classify(record, []);
    expect(result.score).toBeGreaterThanOrEqual(40);
    expect(["MEDIUM", "HIGH"]).toContain(result.label);
    expect(result.relevant).toBe(true);
  });

  it("deve aumentar score com keywords de relevância", () => {
    const classifier = new RequestClassifier(makeConfig());

    const record = makeRecord({
      request: { method: "POST", url: "https://api.example.com/proposal/create", pathname: "/proposal/create", bodyPreview: "proposal submission data" },
      response: { status: 201, contentType: "application/json" }
    });

    const result = classifier.classify(record, []);
    expect(result.reasons.some((r) => r.includes("Palavras-chave relevantes"))).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it("deve reconhecer domain match para simulation", () => {
    const classifier = new RequestClassifier(makeConfig());

    const record = makeRecord({
      request: { method: "POST", url: "https://api.example.com/simulation/calculate", pathname: "/simulation/calculate", bodyPreview: "simulation request" },
      response: { status: 200, bodyPreview: "installment details", contentType: "application/json" }
    });

    const result = classifier.classify(record, []);
    expect(result.reasons.some((r) => r.includes("simulation"))).toBe(true);
    expect(record.domainDefinitionId).toBe("simulation");
  });

  it("deve registrar observação para falhas HTTP", () => {
    const classifier = new RequestClassifier(makeConfig());

    const record = makeRecord({
      request: { method: "POST", url: "https://api.example.com/submit", pathname: "/submit" },
      response: { status: 500, ok: false }
    });

    const result = classifier.classify(record, []);
    expect(result.observations.some((o) => o.includes("500"))).toBe(true);
  });

  it("deve aumentar score com burst de requests", () => {
    const classifier = new RequestClassifier(makeConfig());
    const now = new Date();

    const recent = makeRecord({
      request: { method: "POST", url: "https://api.example.com/step1", pathname: "/step1", timestamp: now.toISOString() },
      response: { status: 200 }
    });

    const current = makeRecord({
      request: { method: "GET", url: "https://api.example.com/step2", pathname: "/step2", timestamp: new Date(now.getTime() + 2000).toISOString() },
      response: { status: 200 }
    });

    const resultWithBurst = classifier.classify(current, [recent]);
    const resultWithoutBurst = classifier.classify(current, []);

    expect(resultWithBurst.score).toBeGreaterThan(resultWithoutBurst.score);
  });

  it("deve classificar como LOW quando score está abaixo do threshold", () => {
    const classifier = new RequestClassifier(makeConfig());

    const record = makeRecord({
      request: { method: "GET", url: "https://api.example.com/static", pathname: "/static" },
      response: { status: 200 }
    });

    const result = classifier.classify(record, []);
    expect(result.label).toBe("LOW");
  });

  it("deve marcar como relevante quando é método mutável", () => {
    const classifier = new RequestClassifier(makeConfig());

    const record = makeRecord({
      request: { method: "DELETE", url: "https://api.example.com/item/1", pathname: "/item/1" },
      response: { status: 204 }
    });

    const result = classifier.classify(record, []);
    expect(result.relevant).toBe(true);
  });

  it("deve detectar transição de sequência de domínio", () => {
    const classifier = new RequestClassifier(makeConfig());
    const now = new Date();

    const previousRecord = makeRecord({
      request: {
        method: "POST",
        url: "https://api.example.com/customer/search",
        pathname: "/customer/search",
        timestamp: now.toISOString()
      },
      response: { status: 200 }
    });
    previousRecord.domainStage = "customer_lookup";

    const currentRecord = makeRecord({
      request: {
        method: "POST",
        url: "https://api.example.com/simulation/run",
        pathname: "/simulation/run",
        timestamp: new Date(now.getTime() + 5000).toISOString(),
        bodyPreview: "simulation data"
      },
      response: { status: 200, bodyPreview: "installment data" }
    });

    const result = classifier.classify(currentRecord, [previousRecord]);
    expect(result.reasons.some((r) => r.includes("Transição de fluxo coerente"))).toBe(true);
  });
});
