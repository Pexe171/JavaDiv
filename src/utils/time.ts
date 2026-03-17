export function nowIso(): string {
  return new Date().toISOString();
}

export function toTimestampId(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function formatDuration(durationMs: number): string {
  return `${Math.max(0, Math.round(durationMs))}ms`;
}

export function toSafeFileSegment(value: string): string {
  const sanitized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized || "default";
}
