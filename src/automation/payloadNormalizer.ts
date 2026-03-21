import { isPlainObject, safeJsonParse } from "../utils/json";

function decodeFormValue(value: string): string {
  return value.replace(/\+/g, " ");
}

function setDeepValue(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return;
  }

  let current: Record<string, unknown> = target;
  for (const [index, segment] of segments.entries()) {
    const isLast = index === segments.length - 1;
    if (isLast) {
      current[segment] = value;
      return;
    }

    const existing = current[segment];
    if (!isPlainObject(existing)) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }
}

function normalizeKey(key: string): string {
  return key.replace(/\[(.*?)\]/g, (_, group: string) => (group ? `.${group}` : ""));
}

function normalizeScalar(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === "") {
    return "";
  }

  if (trimmed === "true") {
    return true;
  }

  if (trimmed === "false") {
    return false;
  }

  if (/^-?\d+(?:[.,]\d+)?$/.test(trimmed)) {
    const normalized = trimmed.includes(",") && !trimmed.includes(".") ? trimmed.replace(",", ".") : trimmed;
    const numeric = Number(normalized);
    if (!Number.isNaN(numeric)) {
      return numeric;
    }
  }

  return trimmed;
}

function parseUrlEncoded(raw: string): Record<string, unknown> {
  const params = new URLSearchParams(raw);
  const result: Record<string, unknown> = {};
  for (const [key, value] of params.entries()) {
    setDeepValue(result, normalizeKey(decodeFormValue(key)), normalizeScalar(decodeURIComponent(decodeFormValue(value))));
  }
  return result;
}

function parseMultipart(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const namePattern = /name="([^"]+)"/i;
  const parts = raw.split(/\r?\n--/).map((part) => part.trim()).filter(Boolean);

  for (const part of parts) {
    const nameMatch = part.match(namePattern);
    if (!nameMatch) {
      continue;
    }

    const chunks = part.split(/\r?\n\r?\n/);
    const value = chunks.slice(1).join("\n\n").replace(/\r?\n--$/, "").trim();
    if (!value || /filename=/i.test(part)) {
      continue;
    }

    setDeepValue(result, normalizeKey(nameMatch[1] ?? ""), normalizeScalar(value));
  }

  return result;
}

export function normalizeRequestBody(body: unknown, contentType?: string): unknown {
  if (body === null || body === undefined) {
    return body;
  }

  if (isPlainObject(body) || Array.isArray(body)) {
    return body;
  }

  if (typeof body !== "string") {
    return body;
  }

  const normalizedContentType = contentType?.toLowerCase() ?? "";
  if (normalizedContentType.includes("application/json")) {
    return safeJsonParse<unknown>(body) ?? body;
  }

  if (normalizedContentType.includes("application/x-www-form-urlencoded")) {
    return parseUrlEncoded(body);
  }

  if (normalizedContentType.includes("multipart/form-data")) {
    return parseMultipart(body);
  }

  const parsed = safeJsonParse<unknown>(body);
  return parsed ?? body;
}
