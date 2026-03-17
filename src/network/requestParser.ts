import { randomUUID } from "node:crypto";

import type { Request, Response } from "playwright";

import type { AppConfig } from "../types/config";
import type { CapturedRequest, CapturedResponse, HttpMethod } from "../types/network";
import { nowIso } from "../utils/time";
import { NetworkRedactor } from "./redactor";

export interface CaptureDecision {
  capture: boolean;
  reasons: string[];
}

export class RequestParser {
  public constructor(
    private readonly config: AppConfig,
    private readonly redactor: NetworkRedactor
  ) {}

  public shouldCaptureRequest(request: Request): CaptureDecision {
    const reasons: string[] = [];
    const method = request.method().toUpperCase();
    const resourceType = request.resourceType();
    const url = new URL(request.url());
    const normalizedUrl = url.toString().toLowerCase();

    if (!["fetch", "xhr"].includes(resourceType)) {
      reasons.push(`resource type ${resourceType} is not fetch/xhr`);
    }

    if (this.config.ignoredResourceTypes.includes(resourceType)) {
      reasons.push(`resource type ${resourceType} ignored by config`);
    }

    if (
      this.config.allowlistDomains.length > 0 &&
      !this.config.allowlistDomains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))
    ) {
      reasons.push(`domain ${url.hostname} outside allowlist`);
    }

    for (const pattern of this.config.ignoredUrlPatterns) {
      if (normalizedUrl.includes(pattern.toLowerCase())) {
        reasons.push(`URL matched ignored pattern: ${pattern}`);
      }
    }

    if (method === "GET") {
      const isRelevantGet = this.config.includeGetKeywords.some((keyword) => normalizedUrl.includes(keyword.toLowerCase()));
      if (!isRelevantGet) {
        reasons.push("GET request without configured bootstrap keyword");
      }
    }

    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      reasons.push(`method ${method} not supported`);
    }

    return {
      capture: reasons.length === 0,
      reasons
    };
  }

  public parseRequest(request: Request, sequence: number): CapturedRequest {
    const method = request.method().toUpperCase() as HttpMethod;
    const url = new URL(request.url());
    const rawHeaders = request.headers();
    const redactedBody = this.redactor.redactBody(
      request.postData() ?? undefined,
      rawHeaders["content-type"],
      this.config.requestBodyPreviewLimit,
      this.config.maxBodyBytesToStore
    );

    let frameUrl: string | undefined;
    let pageUrl: string | undefined;
    try {
      frameUrl = request.frame().url();
      pageUrl = request.frame().page()?.url();
    } catch {
      frameUrl = undefined;
      pageUrl = undefined;
    }

    return {
      id: randomUUID(),
      timestamp: nowIso(),
      sequence,
      method,
      url: url.toString(),
      pathname: url.pathname,
      queryParams: this.redactor.sanitizeQuery(this.extractQueryParams(url)),
      headers: this.redactor.sanitizeHeaders(rawHeaders),
      body: redactedBody.data,
      bodyPreview: redactedBody.preview,
      bodyTruncated: redactedBody.truncated,
      resourceType: request.resourceType(),
      frameUrl,
      pageUrl,
      initiator: frameUrl ?? pageUrl ?? url.origin
    };
  }

  public async parseResponse(response: Response | null, startedAt: number): Promise<CapturedResponse> {
    if (!response) {
      return {
        status: undefined,
        headers: {},
        body: { error: "Request finished without response" },
        bodyPreview: "Request finished without response",
        bodyTruncated: false,
        durationMs: Date.now() - startedAt,
        ok: false,
        redirected: false,
        error: "missing_response"
      };
    }

    const headers = await response.allHeaders();
    const contentType = headers["content-type"];
    let bodyResult;

    try {
      if (contentType && this.isTextualContent(contentType)) {
        bodyResult = this.redactor.redactBody(await response.text(), contentType, this.config.responseBodyPreviewLimit, this.config.maxBodyBytesToStore);
      } else {
        bodyResult = this.redactor.redactBody(await response.body(), contentType, this.config.responseBodyPreviewLimit, this.config.maxBodyBytesToStore);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to read response body";
      bodyResult = {
        data: { error: message },
        preview: message,
        truncated: false,
        notes: [message],
        sizeBytes: 0
      };
    }

    return {
      status: response.status(),
      headers: this.redactor.sanitizeHeaders(headers),
      body: bodyResult.data,
      bodyPreview: bodyResult.preview,
      bodyTruncated: bodyResult.truncated,
      durationMs: Date.now() - startedAt,
      ok: response.ok(),
      redirected: response.status() >= 300 && response.status() < 400,
      contentType,
      error: undefined
    };
  }

  public buildFailedResponse(errorText: string, startedAt: number): CapturedResponse {
    return {
      status: undefined,
      headers: {},
      body: { error: errorText },
      bodyPreview: errorText,
      bodyTruncated: false,
      durationMs: Date.now() - startedAt,
      ok: false,
      redirected: false,
      error: errorText
    };
  }

  private extractQueryParams(url: URL): Record<string, string | string[]> {
    const result: Record<string, string | string[]> = {};
    for (const [key, value] of url.searchParams.entries()) {
      const existing = result[key];
      if (existing === undefined) {
        result[key] = value;
      } else if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        result[key] = [existing, value];
      }
    }
    return result;
  }

  private isTextualContent(contentType: string): boolean {
    return /(application\/json|application\/xml|application\/x-www-form-urlencoded|text\/|application\/javascript)/i.test(contentType);
  }
}
