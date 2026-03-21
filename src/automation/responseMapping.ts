import { isPlainObject } from "../utils/json";
import type { ExtractionCandidate, ExtractionValueType } from "./types";

const RESPONSE_LABEL_HINTS: Array<{ pattern: RegExp; valueType: ExtractionValueType; confidence: number; reason: string }> = [
  { pattern: /(approved|approval|status|decision|resultado|situacao|situação)/i, valueType: "string", confidence: 0.88, reason: "Campo com semântica de decisão ou status." },
  { pattern: /(amount|valor|installment|parcela|payment|rate|interest|iof|cet|total|limit)/i, valueType: "currency", confidence: 0.9, reason: "Campo com semântica financeira na resposta." },
  { pattern: /(date|data|due|venc|expiration|validade)/i, valueType: "date", confidence: 0.85, reason: "Campo com semântica de data na resposta." },
  { pattern: /(term|prazo|months|meses)/i, valueType: "number", confidence: 0.75, reason: "Campo numérico relevante para simulação." }
];

function inferTypeFromLabel(label: string, sample: unknown): { valueType: ExtractionValueType; confidence: number; reason: string } | undefined {
  for (const hint of RESPONSE_LABEL_HINTS) {
    if (hint.pattern.test(label)) {
      return {
        valueType: hint.valueType,
        confidence: hint.confidence,
        reason: hint.reason
      };
    }
  }

  if (typeof sample === "boolean") {
    return { valueType: "boolean", confidence: 0.72, reason: "Valor booleano encontrado na resposta." };
  }

  if (typeof sample === "number") {
    return { valueType: "number", confidence: 0.68, reason: "Valor numérico encontrado na resposta." };
  }

  if (typeof sample === "string") {
    if (/R\$\s?\d|\d+[.,]\d{2}/.test(sample)) {
      return { valueType: "currency", confidence: 0.8, reason: "Valor textual parece monetário." };
    }

    if (/^\d{2}\/\d{2}\/\d{4}$|^\d{4}-\d{2}-\d{2}/.test(sample)) {
      return { valueType: "date", confidence: 0.75, reason: "Valor textual parece data." };
    }
  }

  return undefined;
}

function sampleValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function collectJsonCandidates(value: unknown, path: string, candidates: ExtractionCandidate[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectJsonCandidates(item, `${path}.${index}`, candidates));
    return;
  }

  if (isPlainObject(value)) {
    for (const [key, nested] of Object.entries(value)) {
      const nextPath = path ? `${path}.${key}` : key;
      collectJsonCandidates(nested, nextPath, candidates);
    }
    return;
  }

  if (!path || value === null || value === undefined) {
    return;
  }

  const inferred = inferTypeFromLabel(path, value);
  if (!inferred) {
    return;
  }

  candidates.push({
    key: path.split(".").filter(Boolean).join("_"),
    label: path,
    sampleValue: sampleValue(value),
    strategy: "json-path",
    selector: path,
    valueType: inferred.valueType,
    confidence: inferred.confidence,
    reason: inferred.reason,
    enabled: inferred.confidence >= 0.75
  });
}

function inferRegexType(label: string, value: string): { valueType: ExtractionValueType; confidence: number; reason: string } | undefined {
  return inferTypeFromLabel(label, value) ?? inferTypeFromLabel(value, value);
}

function escapeRegex(label: string): string {
  return label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectTextCandidates(body: string): ExtractionCandidate[] {
  const lines = body
    .split(/\r?\n/)
    .map((line) => line.replace(/<[^>]+>/g, " ").trim())
    .filter((line) => line.length > 0);

  const candidates: ExtractionCandidate[] = [];
  for (const line of lines) {
    const match = line.match(/^([^:]{2,50})\s*:\s*(.+)$/);
    if (!match) {
      continue;
    }

    const label = match[1]?.trim() ?? "";
    const value = match[2]?.trim() ?? "";
    if (!label || !value) {
      continue;
    }

    const inferred = inferRegexType(label, value);
    if (!inferred) {
      continue;
    }

    const key = label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase() || "field";

    candidates.push({
      key,
      label,
      sampleValue: value,
      strategy: "regex",
      selector: `${escapeRegex(label)}\\s*:\\s*([^\\r\\n<]+)`,
      valueType: inferred.valueType,
      confidence: inferred.confidence,
      reason: inferred.reason,
      enabled: inferred.confidence >= 0.75
    });
  }

  return candidates;
}

export function inferResponseExtractions(body: unknown, contentType?: string): ExtractionCandidate[] {
  const normalizedContentType = contentType?.toLowerCase() ?? "";
  let candidates: ExtractionCandidate[] = [];

  if (isPlainObject(body) || Array.isArray(body) || normalizedContentType.includes("json")) {
    collectJsonCandidates(body, "", candidates);
  } else if (typeof body === "string") {
    candidates = collectTextCandidates(body);
  }

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const signature = `${candidate.strategy}:${candidate.selector}`;
    if (seen.has(signature)) {
      return false;
    }
    seen.add(signature);
    return true;
  });
}
