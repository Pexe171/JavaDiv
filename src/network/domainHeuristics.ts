import type { AppConfig, DomainFlowDefinition, DomainSequenceRule } from "../types/config";
import type { RequestRecord } from "../types/network";

export interface DomainMatch {
  definition: DomainFlowDefinition;
  matchedUrlPatterns: string[];
  matchedRequestKeywords: string[];
  matchedResponseKeywords: string[];
  matchedRouteKeywords: string[];
  signals: string[];
  scoreBoost: number;
}

function normalize(value: string): string {
  return value.toLowerCase();
}

function findMatches(content: string, candidates: string[]): string[] {
  const normalizedContent = normalize(content);
  return candidates.filter((candidate) => normalizedContent.includes(normalize(candidate)));
}

function getRouteContext(record: RequestRecord): string {
  return `${record.request.pageUrl ?? ""} ${record.request.frameUrl ?? ""} ${record.request.pathname}`.trim();
}

function getSearchableRequestContent(record: RequestRecord): string {
  return [
    record.request.url,
    record.request.pathname,
    JSON.stringify(record.request.queryParams),
    record.request.bodyPreview
  ]
    .filter(Boolean)
    .join(" ");
}

function getSearchableResponseContent(record: RequestRecord): string {
  return [record.response?.bodyPreview ?? "", record.response?.contentType ?? ""].join(" ");
}

export function detectDomainMatches(record: RequestRecord, config: AppConfig): DomainMatch[] {
  const requestContent = getSearchableRequestContent(record);
  const responseContent = getSearchableResponseContent(record);
  const routeContext = getRouteContext(record);
  const isMutable = ["POST", "PUT", "PATCH", "DELETE"].includes(record.request.method);
  const isSuccess = [200, 201, 202].includes(record.response?.status ?? 0);

  const matches: DomainMatch[] = [];

  for (const definition of config.domainFlowDefinitions) {
    const matchedUrlPatterns = findMatches(record.request.url, definition.urlPatterns);
    const matchedRequestKeywords = findMatches(requestContent, definition.requestKeywords);
    const matchedResponseKeywords = findMatches(responseContent, definition.responseKeywords);
    const matchedRouteKeywords = findMatches(routeContext, definition.routeKeywords);

    const totalSignals =
      matchedUrlPatterns.length +
      matchedRequestKeywords.length +
      matchedResponseKeywords.length +
      matchedRouteKeywords.length;

    if (totalSignals === 0) {
      continue;
    }

    let scoreBoost = definition.baseScoreBoost;
    scoreBoost += matchedUrlPatterns.length * 8;
    scoreBoost += matchedRequestKeywords.length * 6;
    scoreBoost += matchedResponseKeywords.length * 5;
    scoreBoost += matchedRouteKeywords.length * 4;

    if (isMutable) {
      scoreBoost += definition.mutableScoreBoost;
    }
    if (isSuccess) {
      scoreBoost += definition.successScoreBoost;
    }

    const signals = [
      ...matchedUrlPatterns.map((value) => `url:${value}`),
      ...matchedRequestKeywords.map((value) => `request:${value}`),
      ...matchedResponseKeywords.map((value) => `response:${value}`),
      ...matchedRouteKeywords.map((value) => `route:${value}`)
    ];

    matches.push({
      definition,
      matchedUrlPatterns,
      matchedRequestKeywords,
      matchedResponseKeywords,
      matchedRouteKeywords,
      signals,
      scoreBoost
    });
  }

  return matches.sort((left, right) => right.scoreBoost - left.scoreBoost);
}

export function findPrimaryDomainMatch(record: RequestRecord, config: AppConfig): DomainMatch | undefined {
  return detectDomainMatches(record, config)[0];
}

export function findDomainDefinitionById(config: AppConfig, definitionId: string | undefined): DomainFlowDefinition | undefined {
  if (!definitionId) {
    return undefined;
  }

  return config.domainFlowDefinitions.find((definition) => definition.id === definitionId);
}

export function findSequenceRule(
  previousStage: string | undefined,
  currentStage: string | undefined,
  deltaMs: number,
  config: AppConfig
): DomainSequenceRule | undefined {
  if (!previousStage || !currentStage) {
    return undefined;
  }

  return config.domainSequenceRules.find(
    (rule) => rule.fromStage === previousStage && rule.toStage === currentStage && deltaMs <= rule.maxGapMs
  );
}

export function summarizeDomainReason(match: DomainMatch): string {
  return `Domínio ${match.definition.name} reconhecido por ${match.signals.slice(0, 4).join(", ")}.`;
}
