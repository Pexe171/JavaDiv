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
