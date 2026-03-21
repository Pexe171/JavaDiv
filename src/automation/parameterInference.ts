import type { ParameterCandidate, ParameterValueType } from "./types";
import { normalizeRequestBody } from "./payloadNormalizer";
import { isPlainObject } from "../utils/json";

const VARIABLE_HINTS: Array<{ pattern: RegExp; valueType: ParameterValueType; confidence: number; reason: string }> = [
  { pattern: /(income|salary|amount|valor|parcela|installment|loan|price|payment|limit|entry)/i, valueType: "currency", confidence: 0.92, reason: "Campo com semântica financeira." },
  { pattern: /(date|data|birth|venc|due|expiration|expira)/i, valueType: "date", confidence: 0.88, reason: "Campo com semântica de data." },
  { pattern: /(cpf|cnpj|document|doc|rg)/i, valueType: "document", confidence: 0.95, reason: "Campo com semântica de documento." },
  { pattern: /(city|state|county|municip|bairro|region|location|cep|zip|postal|ibge|productid|offerid|tableid|codigo)/i, valueType: "identifier", confidence: 0.82, reason: "Campo com semântica de identificador ou localização." },
  { pattern: /(age|idade|term|prazo|months|meses)/i, valueType: "number", confidence: 0.78, reason: "Campo numérico típico de entrada de simulação." }
];

const RESERVED_FIELD_PATTERN = /(token|secret|password|authorization|cookie|csrf|session)/i;

function toSampleValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

function toSuggestedName(path: string): string {
  const raw = path.split(".").filter(Boolean);
  if (raw.length === 0) {
    return "param";
  }

  const merged = raw.join("_").replace(/[^a-zA-Z0-9_]+/g, "_");
  const camel = merged
    .split(/_+/)
    .filter(Boolean)
    .map((part, index) => {
      const lower = part.toLowerCase();
      if (index === 0) {
        return lower;
      }
      return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    })
    .join("");

  return camel || "param";
}

function inferValueType(path: string, value: unknown): { type: ParameterValueType; confidence: number; reason: string } | undefined {
  for (const hint of VARIABLE_HINTS) {
    if (hint.pattern.test(path)) {
      return {
        type: hint.valueType,
        confidence: hint.confidence,
        reason: hint.reason
      };
    }
  }

  if (typeof value === "number") {
    return {
      type: "number",
      confidence: 0.65,
      reason: "Campo numérico capturado em payload mutável."
    };
  }

  if (typeof value === "string") {
    if (/^\d{11,14}$/.test(value.replace(/\D/g, ""))) {
      return {
        type: "document",
        confidence: 0.84,
        reason: "Valor parece documento numérico."
      };
    }

    if (/^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      return {
        type: "date",
        confidence: 0.8,
        reason: "Valor parece data."
      };
    }

    if (/^\d+[.,]\d{2}$/.test(value.replace(/\s/g, ""))) {
      return {
        type: "currency",
        confidence: 0.76,
        reason: "Valor textual parece monetário."
      };
    }

    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(value) || /^\d{5,}$/.test(value)) {
      return {
        type: "identifier",
        confidence: 0.7,
        reason: "Valor textual parece identificador."
      };
    }
  }

  return undefined;
}

function collectCandidates(value: unknown, path: string, candidates: ParameterCandidate[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectCandidates(item, `${path}.${index}`, candidates));
    return;
  }

  if (isPlainObject(value)) {
    for (const [key, nested] of Object.entries(value)) {
      const nextPath = path ? `${path}.${key}` : key;
      collectCandidates(nested, nextPath, candidates);
    }
    return;
  }

  if (!path || value === null || value === undefined) {
    return;
  }

  if (RESERVED_FIELD_PATTERN.test(path)) {
    return;
  }

  const inferred = inferValueType(path, value);
  if (!inferred) {
    return;
  }

  candidates.push({
    path,
    suggestedName: toSuggestedName(path),
    sampleValue: toSampleValue(value),
    valueType: inferred.type,
    confidence: inferred.confidence,
    reason: inferred.reason,
    enabled: inferred.confidence >= 0.75
  });
}

export function inferParameterCandidates(body: unknown, contentType?: string): ParameterCandidate[] {
  const normalized = normalizeRequestBody(body, contentType);
  const candidates: ParameterCandidate[] = [];
  collectCandidates(normalized, "", candidates);

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.path)) {
      return false;
    }
    seen.add(candidate.path);
    return true;
  });
}
