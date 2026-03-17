export type ExportFormat = "axios" | "httpx" | "curl" | "markdown";
export type RedactionTarget = "headers" | "body" | "query" | "all";

export interface RedactionRule {
  keyPattern: string;
  replacement: string;
  applyTo: RedactionTarget;
  valuePattern?: string | undefined;
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
  exportFormats: ExportFormat[];
}

export interface SessionState {
  sessionFile: string;
  exists: boolean;
  expired: boolean;
  lastUpdatedAt?: string | undefined;
  cookieCount: number;
  originCount: number;
}
