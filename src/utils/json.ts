export function safeJsonParse<T>(raw: string): T | undefined {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function truncateString(value: string, maxLength: number): { value: string; truncated: boolean } {
  if (value.length <= maxLength) {
    return { value, truncated: false };
  }

  return {
    value: `${value.slice(0, maxLength)}...<truncated>`,
    truncated: true
  };
}

export function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf-8");
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
