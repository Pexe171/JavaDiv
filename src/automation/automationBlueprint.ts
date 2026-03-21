import type { RequestRecord } from "../types/network";
import { buildExportHeaders } from "../exporters/shared";
import { inferParameterCandidates } from "./parameterInference";
import { inferResponseExtractions } from "./responseMapping";
import type { AutomationBlueprint, AutomationPlan, ExtractionCandidate, ParameterCandidate } from "./types";

function defaultFunctionName(record: RequestRecord): string {
  const flowName = record.flowName ?? record.domainStage ?? (record.request.pathname.split("/").filter(Boolean).join("-") || "automation");
  const normalized = flowName
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

  const parts = normalized.split(/_+/).filter(Boolean);
  const camel = parts
    .map((part, index) => (index === 0 ? part : `${part.charAt(0).toUpperCase()}${part.slice(1)}`))
    .join("");

  return camel || "runAutomation";
}

function sanitizePlanCandidates<T extends { enabled: boolean }>(items: T[] | undefined, fallback: T[]): T[] {
  const selected = items?.filter((item) => item.enabled) ?? [];
  return selected.length > 0 ? selected : fallback.filter((item) => item.enabled);
}

export function buildAutomationPlan(record: RequestRecord): AutomationPlan {
  const requestContentType = record.request.headers["content-type"] ?? record.request.headers["Content-Type"];
  const parameterCandidates = inferParameterCandidates(record.request.body, requestContentType);
  const extractionCandidates = inferResponseExtractions(record.response?.body, record.response?.contentType);

  return {
    functionName: defaultFunctionName(record),
    parameterCandidates,
    extractionCandidates,
    generatedAt: new Date().toISOString()
  };
}

export function buildAutomationBlueprint(record: RequestRecord, plan: AutomationPlan): AutomationBlueprint {
  const url = new URL(record.request.url);
  const requestContentType = record.request.headers["content-type"] ?? record.request.headers["Content-Type"];
  const selectedParameters = sanitizePlanCandidates<ParameterCandidate>(plan.parameterCandidates, inferParameterCandidates(record.request.body, requestContentType));
  const selectedExtractions = sanitizePlanCandidates<ExtractionCandidate>(plan.extractionCandidates, inferResponseExtractions(record.response?.body, record.response?.contentType));

  return {
    functionName: plan.functionName || defaultFunctionName(record),
    method: record.request.method,
    path: `${url.pathname}${url.search}`,
    requestContentType,
    responseContentType: record.response?.contentType,
    headers: buildExportHeaders(record.request.headers),
    body: record.request.body,
    parameters: selectedParameters.map((candidate) => ({
      name: candidate.suggestedName,
      path: candidate.path,
      valueType: candidate.valueType
    })),
    extractions: selectedExtractions.map((candidate) => ({
      key: candidate.key,
      strategy: candidate.strategy,
      selector: candidate.selector,
      valueType: candidate.valueType
    }))
  };
}
