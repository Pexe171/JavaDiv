import { z } from "zod";

export const redactionRuleSchema = z.object({
  keyPattern: z.string().min(1),
  replacement: z.string().min(1),
  applyTo: z.enum(["headers", "body", "query", "all"]),
  valuePattern: z.string().optional()
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
  flowTimeWindowMs: z.number().int().min(1000).default(12000)
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
  exportFormats: z.array(z.enum(["axios", "httpx", "curl", "markdown"]))
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
  flowId: z.string().optional(),
  flowName: z.string().optional(),
  autoObservations: z.array(z.string()),
  manuallyImportant: z.boolean(),
  notes: z.array(z.string()),
  ignoredReason: z.string().optional()
});

export const flowGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
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
