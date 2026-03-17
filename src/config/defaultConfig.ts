import path from "node:path";
import { promises as fs } from "node:fs";

import { appConfigSchema, filtersConfigSchema, keywordsConfigSchema, redactionConfigSchema } from "./schema";
import type { AppConfig } from "../types/config";

const workspaceRoot = process.cwd();
const configRoot = path.join(workspaceRoot, "config");

export const defaultAppConfig: AppConfig = {
  outputDirectory: path.join(workspaceRoot, "logs"),
  sessionDirectory: path.join(workspaceRoot, "sessions"),
  sessionFile: path.join(workspaceRoot, "sessions", "default.json"),
  persistSession: true,
  clearSessionOnStart: false,
  debug: false,
  allowlistDomains: [],
  ignoredResourceTypes: ["image", "media", "font", "stylesheet", "manifest"],
  ignoredUrlPatterns: ["analytics", "telemetry", "hot-update", "sockjs-node", "webpack-hmr", "/_next/static/", "/favicon.ico"],
  includeGetKeywords: ["bootstrap", "config", "session", "customer", "proposal", "simulation"],
  relevanceKeywords: ["create", "submit", "update", "save", "simulation", "proposal", "proposta", "credit", "contract", "customer", "validate", "approval"],
  mediumThreshold: 40,
  highThreshold: 70,
  flowTimeWindowMs: 12000,
  requestBodyPreviewLimit: 512,
  responseBodyPreviewLimit: 768,
  maxBodyBytesToStore: 16384,
  customSensitiveFields: ["authorization", "cookie", "set-cookie", "csrf", "token", "password", "secret", "cpf", "email", "phone", "fullName", "nomeCompleto", "customerName", "name", "motherName"],
  redactionRules: [
    { keyPattern: "authorization", replacement: "Bearer ***REDACTED***", applyTo: "headers" },
    { keyPattern: "cookie", replacement: "***REDACTED***", applyTo: "headers" },
    { keyPattern: "set-cookie", replacement: "***REDACTED***", applyTo: "headers" },
    { keyPattern: "csrf", replacement: "***REDACTED***", applyTo: "all" },
    { keyPattern: "token", replacement: "***REDACTED***", applyTo: "all" },
    { keyPattern: "password", replacement: "***REDACTED***", applyTo: "body" },
    { keyPattern: "cpf", replacement: "***REDACTED***", applyTo: "body" },
    { keyPattern: "email", replacement: "***REDACTED***", applyTo: "body" }
  ],
  domainFlowDefinitions: [
    {
      id: "login",
      name: "login",
      stage: "authentication",
      urlPatterns: ["login", "signin", "auth", "oauth", "token", "session"],
      requestKeywords: ["login", "auth", "password", "token"],
      responseKeywords: ["authenticated", "logged", "session"],
      routeKeywords: ["/login", "/auth", "/signin"],
      actionLabel: "manual authentication",
      baseScoreBoost: 18,
      mutableScoreBoost: 8,
      successScoreBoost: 10,
      startNewFlowOnMatch: true
    },
    {
      id: "customer-search",
      name: "customer-search",
      stage: "customer_lookup",
      urlPatterns: ["customer", "cliente", "contact", "person", "document", "search", "lookup", "profile"],
      requestKeywords: ["customer", "cliente", "cpf", "document", "search", "lookup"],
      responseKeywords: ["customer", "profile", "document", "person"],
      routeKeywords: ["/customer", "/cliente", "/search", "/lookup"],
      actionLabel: "customer lookup",
      baseScoreBoost: 20,
      mutableScoreBoost: 5,
      successScoreBoost: 8,
      startNewFlowOnMatch: true
    },
    {
      id: "eligibility-bootstrap",
      name: "eligibility-bootstrap",
      stage: "eligibility_bootstrap",
      urlPatterns: ["eligibility", "bootstrap", "preload", "offer", "limit", "catalog"],
      requestKeywords: ["eligibility", "bootstrap", "limit", "offer", "catalog"],
      responseKeywords: ["eligibility", "limit", "offer", "catalog"],
      routeKeywords: ["/bootstrap", "/config", "/eligibility"],
      actionLabel: "eligibility bootstrap",
      baseScoreBoost: 16,
      mutableScoreBoost: 2,
      successScoreBoost: 8,
      startNewFlowOnMatch: true
    },
    {
      id: "simulation",
      name: "simulation",
      stage: "simulation",
      urlPatterns: ["simulation", "simulate", "quote", "pricing", "parcel", "installment", "calc"],
      requestKeywords: ["simulation", "simulate", "quote", "pricing", "installment", "loanamount", "amount"],
      responseKeywords: ["installment", "rate", "simulation", "offer", "term"],
      routeKeywords: ["/simulation", "/quote", "/pricing"],
      actionLabel: "credit simulation",
      baseScoreBoost: 22,
      mutableScoreBoost: 8,
      successScoreBoost: 10,
      startNewFlowOnMatch: true
    },
    {
      id: "proposal-submit",
      name: "proposal-submit",
      stage: "proposal_submission",
      urlPatterns: ["proposal", "proposta", "submit", "save", "create", "application"],
      requestKeywords: ["proposal", "proposta", "submit", "save", "application", "proposalid"],
      responseKeywords: ["proposal", "proposta", "applicationid", "created", "submitted"],
      routeKeywords: ["/proposal", "/application", "/submit"],
      actionLabel: "proposal submission",
      baseScoreBoost: 24,
      mutableScoreBoost: 12,
      successScoreBoost: 12,
      startNewFlowOnMatch: true
    },
    {
      id: "document-upload",
      name: "upload-documents",
      stage: "document_upload",
      urlPatterns: ["upload", "document", "arquivo", "attachment", "evidence", "kyc"],
      requestKeywords: ["upload", "document", "arquivo", "attachment", "kyc"],
      responseKeywords: ["uploaded", "document", "attachment", "accepted"],
      routeKeywords: ["/upload", "/document", "/attachment"],
      actionLabel: "document submission",
      baseScoreBoost: 22,
      mutableScoreBoost: 10,
      successScoreBoost: 10,
      startNewFlowOnMatch: true
    },
    {
      id: "approval-review",
      name: "approval-review",
      stage: "approval_review",
      urlPatterns: ["analysis", "approval", "underwrite", "decision", "review", "status"],
      requestKeywords: ["approval", "analysis", "decision", "status", "underwrite"],
      responseKeywords: ["approved", "rejected", "pending", "analysis", "decision"],
      routeKeywords: ["/approval", "/analysis", "/review"],
      actionLabel: "approval review",
      baseScoreBoost: 20,
      mutableScoreBoost: 6,
      successScoreBoost: 8,
      startNewFlowOnMatch: true
    },
    {
      id: "contract-signature",
      name: "contract-signature",
      stage: "contract_signature",
      urlPatterns: ["contract", "signature", "sign", "agreement", "terms"],
      requestKeywords: ["contract", "signature", "sign", "agreement"],
      responseKeywords: ["contract", "signed", "agreement", "signature"],
      routeKeywords: ["/contract", "/signature", "/agreement"],
      actionLabel: "contract step",
      baseScoreBoost: 22,
      mutableScoreBoost: 10,
      successScoreBoost: 10,
      startNewFlowOnMatch: true
    },
    {
      id: "finalization",
      name: "finalization",
      stage: "finalization",
      urlPatterns: ["confirm", "finish", "complete", "final", "success", "receipt"],
      requestKeywords: ["confirm", "finish", "complete", "success", "receipt"],
      responseKeywords: ["completed", "success", "receipt", "finalized"],
      routeKeywords: ["/confirm", "/complete", "/success"],
      actionLabel: "final confirmation",
      baseScoreBoost: 18,
      mutableScoreBoost: 6,
      successScoreBoost: 10,
      startNewFlowOnMatch: true
    }
  ],
  domainSequenceRules: [
    { fromStage: "authentication", toStage: "customer_lookup", maxGapMs: 45000, scoreBoost: 8 },
    { fromStage: "customer_lookup", toStage: "eligibility_bootstrap", maxGapMs: 30000, scoreBoost: 8 },
    { fromStage: "customer_lookup", toStage: "simulation", maxGapMs: 30000, scoreBoost: 10 },
    { fromStage: "eligibility_bootstrap", toStage: "simulation", maxGapMs: 30000, scoreBoost: 8 },
    { fromStage: "simulation", toStage: "proposal_submission", maxGapMs: 45000, scoreBoost: 12 },
    { fromStage: "proposal_submission", toStage: "document_upload", maxGapMs: 60000, scoreBoost: 10 },
    { fromStage: "proposal_submission", toStage: "approval_review", maxGapMs: 60000, scoreBoost: 8 },
    { fromStage: "document_upload", toStage: "approval_review", maxGapMs: 90000, scoreBoost: 10 },
    { fromStage: "approval_review", toStage: "contract_signature", maxGapMs: 120000, scoreBoost: 10 },
    { fromStage: "contract_signature", toStage: "finalization", maxGapMs: 90000, scoreBoost: 12 }
  ],
  exportFormats: ["axios", "httpx", "curl", "markdown"]
};

async function readJsonConfig<T>(filePath: string): Promise<T | undefined> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

export async function loadAppConfig(overrides: Partial<AppConfig> = {}): Promise<AppConfig> {
  const filters = filtersConfigSchema.parse((await readJsonConfig(path.join(configRoot, "filters.json"))) ?? {});
  const keywords = keywordsConfigSchema.parse((await readJsonConfig(path.join(configRoot, "keywords.json"))) ?? {});
  const redaction = redactionConfigSchema.parse((await readJsonConfig(path.join(configRoot, "redaction.json"))) ?? {});

  return appConfigSchema.parse({
    ...defaultAppConfig,
    ...filters,
    ...keywords,
    customSensitiveFields: redaction.customSensitiveFields.length > 0 ? redaction.customSensitiveFields : defaultAppConfig.customSensitiveFields,
    redactionRules: redaction.rules.length > 0 ? redaction.rules : defaultAppConfig.redactionRules,
    domainFlowDefinitions: keywords.domainFlowDefinitions.length > 0 ? keywords.domainFlowDefinitions : defaultAppConfig.domainFlowDefinitions,
    domainSequenceRules: keywords.domainSequenceRules.length > 0 ? keywords.domainSequenceRules : defaultAppConfig.domainSequenceRules,
    ...overrides
  });
}

export function withSessionProfile(config: AppConfig, profile: string): AppConfig {
  const sessionFile = path.join(config.sessionDirectory, `${profile}.json`);
  return {
    ...config,
    sessionFile
  };
}
