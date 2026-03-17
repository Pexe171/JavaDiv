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
  frameUrl?: string;
  pageUrl?: string;
  initiator?: string;
}

export interface CapturedResponse {
  status?: number;
  headers: Record<string, string>;
  body: unknown;
  bodyPreview: string;
  bodyTruncated: boolean;
  durationMs: number;
  ok: boolean;
  redirected: boolean;
  contentType?: string;
  error?: string;
}

export interface RequestRecord {
  request: CapturedRequest;
  response?: CapturedResponse;
  relevance: RelevanceScore;
  scoreValue: number;
  scoreReasons: string[];
  relevant: boolean;
  flowId?: string;
  flowName?: string;
  autoObservations: string[];
  manuallyImportant: boolean;
  notes: string[];
  ignoredReason?: string;
}

export interface ExportArtifact {
  format: string;
  filePath: string;
  requestId?: string;
  content: string;
}
