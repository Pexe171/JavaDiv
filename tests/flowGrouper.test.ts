import { describe, it, expect } from "vitest";
import { FlowGrouper } from "../src/network/flowGrouper";
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
    relevanceKeywords: [],
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
        id: "login",
        name: "login",
        stage: "authentication",
        urlPatterns: ["login", "auth"],
        requestKeywords: ["login"],
        responseKeywords: [],
        routeKeywords: ["/login"],
        actionLabel: "manual authentication",
        baseScoreBoost: 18,
        mutableScoreBoost: 8,
        successScoreBoost: 10,
        startNewFlowOnMatch: true
      },
      {
        id: "simulation",
        name: "simulation",
        stage: "simulation",
        urlPatterns: ["simulation"],
        requestKeywords: ["simulation"],
        responseKeywords: [],
        routeKeywords: ["/simulation"],
        actionLabel: "credit simulation",
        baseScoreBoost: 22,
        mutableScoreBoost: 8,
        successScoreBoost: 10,
        startNewFlowOnMatch: true
      }
    ],
    domainSequenceRules: [
      { fromStage: "authentication", toStage: "simulation", maxGapMs: 30000, scoreBoost: 10 }
    ],
    exportFormats: ["axios"],
    ...overrides
  };
}

function makeRecord(sequence: number, timestampMs: number, overrides: Partial<RequestRecord> & { request?: Partial<RequestRecord["request"]>; response?: Partial<NonNullable<RequestRecord["response"]>> } = {}): RequestRecord {
  const ts = new Date(timestampMs).toISOString();
  const { request: reqOverrides, response: resOverrides, ...rest } = overrides;
  return {
    relevance: "LOW",
    scoreValue: 0,
    scoreReasons: [],
    relevant: false,
    domainSignals: [],
    autoObservations: [],
    manuallyImportant: false,
    notes: [],
    ...rest,
    request: {
      id: `req-${sequence}`,
      timestamp: ts,
      sequence,
      method: "GET",
      url: "https://api.example.com/data",
      pathname: "/data",
      queryParams: {},
      headers: {},
      body: null,
      bodyPreview: "",
      bodyTruncated: false,
      resourceType: "fetch",
      pageUrl: "https://example.com/page",
      ...reqOverrides
    },
    response: {
      status: 200,
      headers: {},
      body: null,
      bodyPreview: "",
      bodyTruncated: false,
      durationMs: 100,
      ok: true,
      redirected: false,
      ...resOverrides
    }
  };
}

describe("FlowGrouper", () => {
  it("deve agrupar requests próximas no mesmo flow", () => {
    const grouper = new FlowGrouper(makeConfig());
    const baseTime = Date.now();

    const records = [
      makeRecord(1, baseTime, { request: { pathname: "/api/data" } }),
      makeRecord(2, baseTime + 1000, { request: { pathname: "/api/data" } }),
      makeRecord(3, baseTime + 2000, { request: { pathname: "/api/data" } })
    ];

    const result = grouper.group(records);
    expect(result.flows).toHaveLength(1);
    expect(result.flows[0]!.requestIds).toHaveLength(3);
  });

  it("deve criar novo flow quando tempo excede janela", () => {
    const grouper = new FlowGrouper(makeConfig({ flowTimeWindowMs: 5000 }));
    const baseTime = Date.now();

    const records = [
      makeRecord(1, baseTime, { request: { pathname: "/api/step1" } }),
      makeRecord(2, baseTime + 10000, { request: { pathname: "/api/step2" } })
    ];

    const result = grouper.group(records);
    expect(result.flows.length).toBeGreaterThanOrEqual(2);
  });

  it("deve atualizar estatísticas do flow corretamente", () => {
    const grouper = new FlowGrouper(makeConfig());
    const baseTime = Date.now();

    const records = [
      makeRecord(1, baseTime, {
        request: { method: "POST", pathname: "/api/submit" },
        relevance: "HIGH"
      }),
      makeRecord(2, baseTime + 500, {
        request: { method: "GET", pathname: "/api/data" },
        relevance: "LOW"
      }),
      makeRecord(3, baseTime + 1000, {
        request: { method: "PUT", pathname: "/api/update" },
        relevance: "MEDIUM",
        response: { status: 500, ok: false, headers: {}, body: null, bodyPreview: "", bodyTruncated: false, durationMs: 100, redirected: false }
      })
    ];

    const result = grouper.group(records);
    const flow = result.flows[0]!;
    expect(flow.statistics.totalRequests).toBe(3);
    expect(flow.statistics.mutableRequests).toBe(2);
    expect(flow.statistics.highPriorityRequests).toBe(1);
    expect(flow.statistics.failedRequests).toBe(1);
  });

  it("deve promover relevância do flow para a mais alta", () => {
    const grouper = new FlowGrouper(makeConfig());
    const baseTime = Date.now();

    const records = [
      makeRecord(1, baseTime, { relevance: "LOW", request: { pathname: "/api/data" } }),
      makeRecord(2, baseTime + 500, { relevance: "HIGH", request: { pathname: "/api/data" } }),
      makeRecord(3, baseTime + 1000, { relevance: "MEDIUM", request: { pathname: "/api/data" } })
    ];

    const result = grouper.group(records);
    expect(result.flows[0]!.relevance).toBe("HIGH");
  });

  it("deve retornar cópias defensivas via getFlows", () => {
    const grouper = new FlowGrouper(makeConfig());
    const baseTime = Date.now();

    grouper.assign(makeRecord(1, baseTime, { request: { pathname: "/api/data" } }));

    const flows1 = grouper.getFlows();
    const flows2 = grouper.getFlows();
    expect(flows1).not.toBe(flows2);
    expect(flows1[0]).not.toBe(flows2[0]);
    expect(flows1[0]!.requestIds).not.toBe(flows2[0]!.requestIds);
  });

  it("deve resetar corretamente", () => {
    const grouper = new FlowGrouper(makeConfig());
    const baseTime = Date.now();

    grouper.assign(makeRecord(1, baseTime, { request: { pathname: "/api/data" } }));
    expect(grouper.getFlows()).toHaveLength(1);

    grouper.reset();
    expect(grouper.getFlows()).toHaveLength(0);
  });

  it("deve inferir nome 'login' para URLs de autenticação via domainDefinition", () => {
    const grouper = new FlowGrouper(makeConfig());
    const baseTime = Date.now();

    const record = makeRecord(1, baseTime, {
      request: { method: "POST", url: "https://api.example.com/login", pathname: "/login" },
      domainDefinitionId: "login"
    });

    const flow = grouper.assign(record);
    expect(flow.name).toBe("login");
  });

  it("deve atribuir flowId e flowName ao record", () => {
    const grouper = new FlowGrouper(makeConfig());
    const baseTime = Date.now();

    const record = makeRecord(1, baseTime, { request: { pathname: "/api/data" } });
    const flow = grouper.assign(record);

    expect(record.flowId).toBe(flow.id);
    expect(record.flowName).toBe(flow.name);
  });

  it("deve inferir actions sem duplicatas", () => {
    const grouper = new FlowGrouper(makeConfig());
    const baseTime = Date.now();

    const records = [
      makeRecord(1, baseTime, { request: { method: "POST", pathname: "/api/data" } }),
      makeRecord(2, baseTime + 200, { request: { method: "POST", pathname: "/api/data" } }),
      makeRecord(3, baseTime + 400, { request: { method: "GET", pathname: "/api/data" } })
    ];

    const result = grouper.group(records);
    const flow = result.flows[0]!;

    const actionSet = new Set(flow.inferredActions);
    expect(actionSet.size).toBe(flow.inferredActions.length);
  });
});
