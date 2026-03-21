import { z } from "zod";

const confidenceSchema = z.number().min(0).max(1);

export const redactionRuleSchema = z.object({
  keyPattern: z.string().min(1),
  replacement: z.string().min(1),
  applyTo: z.enum(["headers", "body", "query", "all"]),
  valuePattern: z.string().optional()
});

export const domainFlowDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  stage: z.string().min(1),
  urlPatterns: z.array(z.string()).default([]),
  requestKeywords: z.array(z.string()).default([]),
  responseKeywords: z.array(z.string()).default([]),
  routeKeywords: z.array(z.string()).default([]),
  actionLabel: z.string().min(1),
  baseScoreBoost: z.number().int().min(0).default(0),
  mutableScoreBoost: z.number().int().min(0).default(0),
  successScoreBoost: z.number().int().min(0).default(0),
  startNewFlowOnMatch: z.boolean().default(true)
});

export const domainSequenceRuleSchema = z.object({
  fromStage: z.string().min(1),
  toStage: z.string().min(1),
  maxGapMs: z.number().int().min(1).default(15000),
  scoreBoost: z.number().int().min(0).default(0)
});


const parameterCandidateSchema = z.object({
  path: z.string().min(1),
  suggestedName: z.string().min(1),
  sampleValue: z.string(),
  valueType: z.enum(["string", "number", "boolean", "currency", "date", "document", "identifier", "unknown"]),
  confidence: confidenceSchema,
  reason: z.string().min(1),
  enabled: z.boolean()
});

const extractionCandidateSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  sampleValue: z.string(),
  strategy: z.enum(["json-path", "regex"]),
  selector: z.string().min(1),
  valueType: z.enum(["string", "number", "currency", "date", "boolean", "unknown"]),
  confidence: confidenceSchema,
  reason: z.string().min(1),
  enabled: z.boolean()
});

const automationPlanSchema = z.object({
  functionName: z.string().min(1),
  parameterCandidates: z.array(parameterCandidateSchema),
  extractionCandidates: z.array(extractionCandidateSchema),
  generatedAt: z.string().min(1)
});

export const parameterInferenceConfigSchema = z.object({
  enabled: z.boolean().default(true),
  minimumConfidence: confidenceSchema.default(0.75),
  fieldNameHints: z.array(z.string()).default([])
});

export const responseMappingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  minimumConfidence: confidenceSchema.default(0.75),
  labelHints: z.array(z.string()).default([])
});

export const filtersConfigSchema = z.object({
  allowlistDomains: z.array(z.string()).default([]),
  ignoredResourceTypes: z.array(z.string()).default([]),
  ignoredUrlPatterns: z.array(z.string()).default([]),
  includeGetKeywords: z.array(z.string()).default([])
});

export const keywordsConfigSchema = z.object({
  relevanceKeywords: z.array(z.string()).default([]),
  mediumThreshold: z.number().int().min(1).default(40),
  highThreshold: z.number().int().min(1).default(70),
  flowTimeWindowMs: z.number().int().min(1000).default(12000),
  domainFlowDefinitions: z.array(domainFlowDefinitionSchema).default([]),
  domainSequenceRules: z.array(domainSequenceRuleSchema).default([])
});

export const redactionConfigSchema = z.object({
  customSensitiveFields: z.array(z.string()).default([]),
  rules: z.array(redactionRuleSchema).default([])
});

export const appConfigSchema = z.object({
  outputDirectory: z.string().min(1),
  sessionDirectory: z.string().min(1),
  sessionFile: z.string().min(1),
  persistSession: z.boolean(),
  clearSessionOnStart: z.boolean(),
  debug: z.boolean(),
  allowlistDomains: z.array(z.string()),
  ignoredResourceTypes: z.array(z.string()),
  ignoredUrlPatterns: z.array(z.string()),
  includeGetKeywords: z.array(z.string()),
  relevanceKeywords: z.array(z.string()),
  mediumThreshold: z.number().int().min(1),
  highThreshold: z.number().int().min(1),
  flowTimeWindowMs: z.number().int().min(1000),
  requestBodyPreviewLimit: z.number().int().min(32),
  responseBodyPreviewLimit: z.number().int().min(32),
  maxBodyBytesToStore: z.number().int().min(64),
  customSensitiveFields: z.array(z.string()),
  redactionRules: z.array(redactionRuleSchema),
  domainFlowDefinitions: z.array(domainFlowDefinitionSchema),
  domainSequenceRules: z.array(domainSequenceRuleSchema),
  exportFormats: z.array(z.enum(["axios", "httpx", "curl", "fetch", "markdown", "smart"])),
  parameterInference: parameterInferenceConfigSchema,
  responseMapping: responseMappingConfigSchema
});

const keyValueSchema = z.record(z.string(), z.union([z.string(), z.array(z.string())]));

export const capturedRequestSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().min(1),
  sequence: z.number().int().min(1),
  method: z.string().min(1),
  url: z.string().url(),
  pathname: z.string().min(1),
  queryParams: keyValueSchema,
  headers: z.record(z.string(), z.string()),
  body: z.unknown(),
  bodyPreview: z.string(),
  bodyTruncated: z.boolean(),
  resourceType: z.string(),
  frameUrl: z.string().optional(),
  pageUrl: z.string().optional(),
  initiator: z.string().optional()
});

export const capturedResponseSchema = z.object({
  status: z.number().int().optional(),
  headers: z.record(z.string(), z.string()),
  body: z.unknown(),
  bodyPreview: z.string(),
  bodyTruncated: z.boolean(),
  durationMs: z.number().min(0),
  ok: z.boolean(),
  redirected: z.boolean(),
  contentType: z.string().optional(),
  error: z.string().optional()
});

export const requestRecordSchema = z.object({
  request: capturedRequestSchema,
  response: capturedResponseSchema.optional(),
  relevance: z.enum(["LOW", "MEDIUM", "HIGH"]),
  scoreValue: z.number().min(0),
  scoreReasons: z.array(z.string()),
  relevant: z.boolean(),
  domainDefinitionId: z.string().optional(),
  domainStage: z.string().optional(),
  domainSignals: z.array(z.string()).default([]),
  flowId: z.string().optional(),
  flowName: z.string().optional(),
  autoObservations: z.array(z.string()),
  manuallyImportant: z.boolean(),
  notes: z.array(z.string()),
  ignoredReason: z.string().optional(),
  automationPlan: automationPlanSchema.optional()
});

export const flowGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  domainStage: z.string().optional(),
  primaryDefinitionId: z.string().optional(),
  routeContext: z.string().min(1),
  startedAt: z.string().min(1),
  endedAt: z.string().min(1),
  requestIds: z.array(z.string()),
  inferredActions: z.array(z.string()),
  notes: z.array(z.string()),
  relevance: z.enum(["LOW", "MEDIUM", "HIGH"]),
  statistics: z.object({
    totalRequests: z.number().int().min(0),
    mutableRequests: z.number().int().min(0),
    highPriorityRequests: z.number().int().min(0),
    failedRequests: z.number().int().min(0)
  })
});
