import type { AppConfig, RedactionTarget } from "../types/config";

import { byteLength, isPlainObject, safeJsonParse, stableStringify, truncateString } from "../utils/json";

const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const cpfPattern = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const phonePattern = /\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}\b/g;
const bearerPattern = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const basicPattern = /Basic\s+[A-Za-z0-9+/=]+/gi;
const tokenPattern = /\b(?:eyJ[a-zA-Z0-9_\-.]+|[A-F0-9]{32,}|[a-zA-Z0-9_-]{24,})\b/g;

export interface RedactionResult {
  data: unknown;
  preview: string;
  truncated: boolean;
  notes: string[];
  sizeBytes: number;
}

export class NetworkRedactor {
  public constructor(private readonly config: AppConfig) {}

  public sanitizeHeaders(headers: Record<string, string | undefined>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(headers)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, this.sanitizeScalar(value ?? "", key, "headers")])
    );
  }

  public sanitizeQuery(query: Record<string, string | string[]>): Record<string, string | string[]> {
    const sanitizedEntries = Object.entries(query).map(([key, value]) => {
      if (Array.isArray(value)) {
        return [key, value.map((item) => this.sanitizeScalar(item, key, "query"))];
      }
      return [key, this.sanitizeScalar(value, key, "query")];
    });

    return Object.fromEntries(sanitizedEntries);
  }

  public redactBody(
    rawBody: string | Buffer | undefined,
    contentType: string | undefined,
    previewLimit: number,
    maxBytesToStore: number
  ): RedactionResult {
    if (rawBody === undefined) {
      return {
        data: null,
        preview: "",
        truncated: false,
        notes: [],
        sizeBytes: 0
      };
    }

    if (Buffer.isBuffer(rawBody)) {
      return this.redactBinaryBody(rawBody, contentType, previewLimit);
    }

    const notes: string[] = [];
    const normalizedContentType = (contentType ?? "").toLowerCase();

    if (normalizedContentType.includes("multipart/form-data")) {
      const message = "multipart/form-data omitted for safety";
      return {
        data: { multipart: true, note: message },
        preview: message,
        truncated: false,
        notes: [message],
        sizeBytes: byteLength(message)
      };
    }

    let parsedBody: unknown = rawBody;
    if (normalizedContentType.includes("application/json")) {
      parsedBody = safeJsonParse<unknown>(rawBody) ?? rawBody;
      if (parsedBody === rawBody) {
        notes.push("JSON parsing failed; body stored as sanitized string.");
      }
    } else if (normalizedContentType.includes("application/x-www-form-urlencoded")) {
      parsedBody = Object.fromEntries(new URLSearchParams(rawBody).entries());
    } else if (!this.isTextLike(rawBody)) {
      return this.redactBinaryBody(Buffer.from(rawBody), contentType, previewLimit);
    }

    const sanitized = this.sanitizeUnknown(parsedBody, undefined, "body");
    const serialized = typeof sanitized === "string" ? sanitized : stableStringify(sanitized);
    const initialSize = byteLength(serialized);
    const preview = truncateString(serialized, previewLimit);

    if (initialSize > maxBytesToStore) {
      return {
        data: {
          truncated: true,
          approxBytes: initialSize,
          preview: preview.value
        },
        preview: preview.value,
        truncated: true,
        notes: [...notes, `Body truncated from ${initialSize} bytes.`],
        sizeBytes: initialSize
      };
    }

    return {
      data: sanitized,
      preview: preview.value,
      truncated: preview.truncated,
      notes,
      sizeBytes: initialSize
    };
  }

  private redactBinaryBody(rawBody: Buffer, contentType: string | undefined, previewLimit: number): RedactionResult {
    const description = `${contentType ?? "binary"} payload omitted (${rawBody.byteLength} bytes)`;
    const preview = truncateString(description, previewLimit);
    return {
      data: {
        binary: true,
        contentType: contentType ?? "application/octet-stream",
        bytes: rawBody.byteLength
      },
      preview: preview.value,
      truncated: preview.truncated,
      notes: ["Binary body omitted from persisted artifacts."],
      sizeBytes: rawBody.byteLength
    };
  }

  private sanitizeUnknown(value: unknown, key: string | undefined, target: RedactionTarget): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeUnknown(item, key, target));
    }

    if (isPlainObject(value)) {
      const result: Record<string, unknown> = {};
      for (const [entryKey, entryValue] of Object.entries(value)) {
        const replacement = this.findReplacement(entryKey, target);
        if (replacement) {
          result[entryKey] = replacement;
          continue;
        }
        result[entryKey] = this.sanitizeUnknown(entryValue, entryKey, target);
      }
      return result;
    }

    if (typeof value === "string") {
      return this.sanitizeScalar(value, key, target);
    }

    if (key) {
      const replacement = this.findReplacement(key, target);
      if (replacement) {
        return replacement;
      }
    }

    return value;
  }

  private sanitizeScalar(value: string, key: string | undefined, target: RedactionTarget): string {
    const replacement = key ? this.findReplacement(key, target) : undefined;
    if (replacement) {
      return replacement;
    }

    return value
      .replace(bearerPattern, "Bearer ***REDACTED***")
      .replace(basicPattern, "Basic ***REDACTED***")
      .replace(emailPattern, "***REDACTED***")
      .replace(cpfPattern, "***REDACTED***")
      .replace(phonePattern, "***REDACTED***")
      .replace(tokenPattern, "***REDACTED***");
  }

  private findReplacement(key: string, target: RedactionTarget): string | undefined {
    const normalizedKey = key.toLowerCase();
    for (const rule of this.config.redactionRules) {
      const appliesToTarget = rule.applyTo === "all" || rule.applyTo === target;
      if (appliesToTarget && new RegExp(rule.keyPattern, "i").test(normalizedKey)) {
        return rule.replacement;
      }
    }

    if (this.config.customSensitiveFields.some((field) => normalizedKey.includes(field.toLowerCase()))) {
      return "***REDACTED***";
    }

    return undefined;
  }

  private isTextLike(value: string): boolean {
    return /^[\t\n\r\x20-\x7E\x80-\u024F]*$/u.test(value);
  }
}
