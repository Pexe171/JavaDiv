import { stableStringify } from "../utils/json";
import type { AutomationBlueprint } from "../automation/types";

export function buildExportHeaders(headers: Record<string, string>): Record<string, string> {
  const selectedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey.includes("authorization")) {
      selectedHeaders[key] = "Bearer <TOKEN>";
    } else if (normalizedKey.includes("cookie")) {
      selectedHeaders[key] = "<COOKIE>";
    } else if (normalizedKey.includes("csrf")) {
      selectedHeaders[key] = "<CSRF>";
    } else if (["content-type", "accept", "x-requested-with"].includes(normalizedKey)) {
      selectedHeaders[key] = value;
    }
  }
  return selectedHeaders;
}

export function setValueAtPath(target: unknown, path: string, value: unknown): void {
  if (!target || typeof target !== "object" || !path) {
    return;
  }

  const segments = path.split(".").filter(Boolean);
  if (segments.length === 0) {
    return;
  }

  let current = target as Record<string, unknown>;
  for (const [index, segment] of segments.entries()) {
    const isLast = index === segments.length - 1;
    if (isLast) {
      current[segment] = value;
      return;
    }

    const existing = current[segment];
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }
}

export function buildParameterizedBodyExpression(blueprint: AutomationBlueprint, argsIdentifier: string): string {
  const baseBody = stableStringify(blueprint.body ?? null);
  if (blueprint.parameters.length === 0) {
    return baseBody;
  }

  const mutationLines = blueprint.parameters
    .map((parameter) => `  setValueAtPath(payload, ${JSON.stringify(parameter.path)}, ${argsIdentifier}.${parameter.name});`)
    .join("\n");

  return `(() => {\n  const payload = ${baseBody};\n${mutationLines}\n  return payload;\n})()`;
}

export function buildTsExtractionHelpers(blueprint: AutomationBlueprint): string {
  const helperParts: string[] = [
    `function getValueByPath(source: unknown, path: string): unknown {\n  return path.split(".").filter(Boolean).reduce<unknown>((current, segment) => {\n    if (current === null || current === undefined) {\n      return undefined;\n    }\n    if (typeof current !== "object") {\n      return undefined;\n    }\n    return (current as Record<string, unknown>)[segment];\n  }, source);\n}`,
    `function normalizeExtractedValue(value: unknown, valueType: string): unknown {\n  if (typeof value !== "string") {\n    return value;\n  }\n\n  const trimmed = value.trim();\n  if (valueType === "currency") {\n    const normalized = trimmed.replace(/[^\\d,.-]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");\n    const numeric = Number(normalized);\n    return Number.isNaN(numeric) ? trimmed : numeric;\n  }\n\n  if (valueType === "number") {\n    const numeric = Number(trimmed.replace(",", "."));\n    return Number.isNaN(numeric) ? trimmed : numeric;\n  }\n\n  if (valueType === "boolean") {\n    if (/^(true|approved|aprovado|yes|sim)$/i.test(trimmed)) {\n      return true;\n    }\n    if (/^(false|rejected|negado|no|nao|não)$/i.test(trimmed)) {\n      return false;\n    }\n  }\n\n  return trimmed;\n}`,
    `function extractAutomationResult(responseBody: unknown): Record<string, unknown> {\n  const result: Record<string, unknown> = {};\n  const textBody = typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody);`
  ];

  for (const extraction of blueprint.extractions) {
    if (extraction.strategy === "json-path") {
      helperParts.push(`  result[${JSON.stringify(extraction.key)}] = normalizeExtractedValue(getValueByPath(responseBody, ${JSON.stringify(extraction.selector)}), ${JSON.stringify(extraction.valueType)});`);
    } else {
      helperParts.push(`  {\n    const match = textBody.match(new RegExp(${JSON.stringify(extraction.selector)}, "i"));\n    result[${JSON.stringify(extraction.key)}] = normalizeExtractedValue(match?.[1], ${JSON.stringify(extraction.valueType)});\n  }`);
    }
  }

  helperParts.push("  return result;\n}");
  return helperParts.join("\n\n");
}

export function buildPythonExtractionHelpers(blueprint: AutomationBlueprint): string {
  const lines: string[] = [
    "def get_value_by_path(source, path):",
    "    current = source",
    "    for segment in [part for part in path.split('.') if part]:",
    "        if not isinstance(current, dict):",
    "            return None",
    "        current = current.get(segment)",
    "    return current",
    "",
    "def normalize_extracted_value(value, value_type):",
    "    if not isinstance(value, str):",
    "        return value",
    "    trimmed = value.strip()",
    "    if value_type == 'currency':",
    "        normalized = ''.join(ch for ch in trimmed if ch.isdigit() or ch in ',.-').replace('.', '').replace(',', '.')",
    "        try:",
    "            return float(normalized)",
    "        except ValueError:",
    "            return trimmed",
    "    if value_type == 'number':",
    "        try:",
    "            return float(trimmed.replace(',', '.'))",
    "        except ValueError:",
    "            return trimmed",
    "    return trimmed",
    "",
    "def extract_automation_result(response_body, text_body):",
    "    result = {}"
  ];

  for (const extraction of blueprint.extractions) {
    if (extraction.strategy === "json-path") {
      lines.push(`    result[${JSON.stringify(extraction.key)}] = normalize_extracted_value(get_value_by_path(response_body, ${JSON.stringify(extraction.selector)}), ${JSON.stringify(extraction.valueType)})`);
    } else {
      lines.push(`    match_${extraction.key} = re.search(${JSON.stringify(extraction.selector)}, text_body, re.IGNORECASE)`);
      lines.push(`    result[${JSON.stringify(extraction.key)}] = normalize_extracted_value(match_${extraction.key}.group(1) if match_${extraction.key} else None, ${JSON.stringify(extraction.valueType)})`);
    }
  }

  lines.push("    return result");
  return lines.join("\n");
}
