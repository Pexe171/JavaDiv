import { describe, expect, it } from "vitest";

import { buildAutomationBlueprint, buildAutomationPlan } from "../src/automation/automationBlueprint";
import { inferParameterCandidates } from "../src/automation/parameterInference";
import { inferResponseExtractions } from "../src/automation/responseMapping";
import type { RequestRecord } from "../src/types/network";

const baseRecord: RequestRecord = {
  request: {
    id: "req-1",
    timestamp: "2026-03-20T00:00:00.000Z",
    sequence: 1,
    method: "POST",
    url: "https://example.com/api/simulation",
    pathname: "/api/simulation",
    queryParams: {},
    headers: {
      "content-type": "application/json"
    },
    body: {
      amount: 15000,
      customer: {
        birthDate: "1990-12-25",
        cityId: "3550308"
      },
      fixedFlag: true
    },
    bodyPreview: "{}",
    bodyTruncated: false,
    resourceType: "xhr"
  },
  response: {
    status: 200,
    headers: {},
    body: {
      simulation: {
        installmentValue: "R$ 350,90",
        dueDate: "25/03/2026"
      },
      status: "Aprovado"
    },
    bodyPreview: "{}",
    bodyTruncated: false,
    durationMs: 123,
    ok: true,
    redirected: false,
    contentType: "application/json"
  },
  relevance: "HIGH",
  scoreValue: 100,
  scoreReasons: [],
  relevant: true,
  domainSignals: [],
  autoObservations: [],
  manuallyImportant: false,
  notes: [],
  flowId: "flow-1",
  flowName: "simulation"
};

describe("automation inference", () => {
  it("detecta candidatos de parametrização em payload JSON", () => {
    const candidates = inferParameterCandidates(baseRecord.request.body, baseRecord.request.headers["content-type"]);
    expect(candidates.map((candidate) => candidate.path)).toContain("amount");
    expect(candidates.map((candidate) => candidate.path)).toContain("customer.birthDate");
    expect(candidates.map((candidate) => candidate.path)).toContain("customer.cityId");
  });

  it("detecta extrações em resposta JSON", () => {
    const candidates = inferResponseExtractions(baseRecord.response?.body, baseRecord.response?.contentType);
    expect(candidates.map((candidate) => candidate.selector)).toContain("simulation.installmentValue");
    expect(candidates.map((candidate) => candidate.selector)).toContain("simulation.dueDate");
    expect(candidates.map((candidate) => candidate.selector)).toContain("status");
  });

  it("monta blueprint com parâmetros e extrações selecionadas", () => {
    const plan = buildAutomationPlan(baseRecord);
    const blueprint = buildAutomationBlueprint(baseRecord, plan);

    expect(blueprint.functionName).toBe("simulation");
    expect(blueprint.parameters.some((parameter) => parameter.path === "amount")).toBe(true);
    expect(blueprint.extractions.some((extraction) => extraction.selector === "simulation.installmentValue")).toBe(true);
  });
});
