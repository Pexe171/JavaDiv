export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";
export type RelevanceScore = "LOW" | "MEDIUM" | "HIGH";

export interface CapturedRequest {
  id: string;
  timestamp: string;
  sequence: number;
  method: HttpMethod;
  url: string;
  pathname: string;
  queryParams: Record<string, string | string[]>;
  headers: Record<string, string>;
  body: unknown;
  bodyPreview: string;
  bodyTruncated: boolean;
  resourceType: string;
  frameUrl?: string | undefined;
  pageUrl?: string | undefined;
  initiator?: string | undefined;
}

export interface CapturedResponse {
  status?: number | undefined;
  headers: Record<string, string>;
  body: unknown;
  bodyPreview: string;
  bodyTruncated: boolean;
  durationMs: number;
  ok: boolean;
  redirected: boolean;
  contentType?: string | undefined;
  error?: string | undefined;
}

export interface RequestRecord {
  request: CapturedRequest;
  response?: CapturedResponse | undefined;
  relevance: RelevanceScore;
  scoreValue: number;
  scoreReasons: string[];
  relevant: boolean;
  domainDefinitionId?: string | undefined;
  domainStage?: string | undefined;
  domainSignals: string[];
  flowId?: string | undefined;
  flowName?: string | undefined;
  autoObservations: string[];
  manuallyImportant: boolean;
  notes: string[];
  ignoredReason?: string | undefined;
}

export interface ExportArtifact {
  format: string;
  filePath: string;
  requestId?: string | undefined;
  content: string;
}
