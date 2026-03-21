export type ExportFormat = "axios" | "httpx" | "curl" | "fetch" | "markdown" | "smart";
export type RedactionTarget = "headers" | "body" | "query" | "all";

export interface DomainFlowDefinition {
  id: string;
  name: string;
  stage: string;
  urlPatterns: string[];
  requestKeywords: string[];
  responseKeywords: string[];
  routeKeywords: string[];
  actionLabel: string;
  baseScoreBoost: number;
  mutableScoreBoost: number;
  successScoreBoost: number;
  startNewFlowOnMatch: boolean;
}

export interface DomainSequenceRule {
  fromStage: string;
  toStage: string;
  maxGapMs: number;
  scoreBoost: number;
}

export interface RedactionRule {
  keyPattern: string;
  replacement: string;
  applyTo: RedactionTarget;
  valuePattern?: string | undefined;
}

export interface ParameterInferenceConfig {
  enabled: boolean;
  minimumConfidence: number;
  fieldNameHints: string[];
}

export interface ResponseMappingConfig {
  enabled: boolean;
  minimumConfidence: number;
  labelHints: string[];
}

export interface AppConfig {
  outputDirectory: string;
  sessionDirectory: string;
  sessionFile: string;
  persistSession: boolean;
  clearSessionOnStart: boolean;
  debug: boolean;
  allowlistDomains: string[];
  ignoredResourceTypes: string[];
  ignoredUrlPatterns: string[];
  includeGetKeywords: string[];
  relevanceKeywords: string[];
  mediumThreshold: number;
  highThreshold: number;
  flowTimeWindowMs: number;
  requestBodyPreviewLimit: number;
  responseBodyPreviewLimit: number;
  maxBodyBytesToStore: number;
  customSensitiveFields: string[];
  redactionRules: RedactionRule[];
  domainFlowDefinitions: DomainFlowDefinition[];
  domainSequenceRules: DomainSequenceRule[];
  exportFormats: ExportFormat[];
  parameterInference: ParameterInferenceConfig;
  responseMapping: ResponseMappingConfig;
}

export interface SessionState {
  sessionFile: string;
  exists: boolean;
  expired: boolean;
  lastUpdatedAt?: string | undefined;
  cookieCount: number;
  originCount: number;
}
