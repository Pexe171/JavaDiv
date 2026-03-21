import path from "node:path";

import { buildAutomationBlueprint, buildAutomationPlan } from "../automation/automationBlueprint";
import type { AutomationPlan } from "../automation/types";
import type { AppConfig, ExportFormat } from "../types/config";
import type { ExportArtifact, RequestRecord } from "../types/network";
import { saveText } from "../storage/saveJson";
import { stableStringify } from "../utils/json";
import { buildParameterizedBodyExpression, buildPythonExtractionHelpers, buildTsExtractionHelpers } from "./shared";

function toArgumentType(valueType: string): string {
  if (["number", "currency"].includes(valueType)) {
    return "number";
  }
  if (valueType === "boolean") {
    return "boolean";
  }
  return "string";
}

function renderTsAutomation(record: RequestRecord, plan: AutomationPlan): string {
  const blueprint = buildAutomationBlueprint(record, plan);
  const argsType = blueprint.parameters.length > 0
    ? `{ ${blueprint.parameters.map((parameter) => `${parameter.name}: ${toArgumentType(parameter.valueType)}`).join("; ")} }`
    : "Record<string, never>";
  const payloadExpression = buildParameterizedBodyExpression(blueprint, "args");
  const hasBody = blueprint.body !== null && blueprint.body !== undefined && !["GET", "HEAD", "OPTIONS"].includes(blueprint.method);
  const parseAsJson = blueprint.responseContentType?.toLowerCase().includes("json") ?? false;
  const bodyLine = hasBody ? `    body: JSON.stringify(payload),\n` : "";

  return `function setValueAtPath(target: unknown, path: string, value: unknown): void {\n  if (!target || typeof target !== "object") {\n    return;\n  }\n\n  const segments = path.split(".").filter(Boolean);\n  let current = target as Record<string, unknown>;\n  for (const [index, segment] of segments.entries()) {\n    const isLast = index === segments.length - 1;\n    if (isLast) {\n      current[segment] = value;\n      return;\n    }\n\n    const existing = current[segment];\n    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {\n      current[segment] = {};\n    }\n\n    current = current[segment] as Record<string, unknown>;\n  }\n}\n\n${buildTsExtractionHelpers(blueprint)}\n\nexport async function ${blueprint.functionName}(args: ${argsType}) {\n  const payload = ${payloadExpression};\n  const response = await fetch(\`<BASE_URL>${blueprint.path}\`, {\n    method: ${JSON.stringify(blueprint.method)},\n    headers: ${stableStringify(blueprint.headers)},\n${bodyLine}  });\n\n  const responseBody = ${parseAsJson ? "await response.json()" : "await response.text()"};\n\n  return {\n    status: response.status,\n    ok: response.ok,\n    data: extractAutomationResult(responseBody)\n  };\n}\n`;
}

function renderAxiosAutomation(record: RequestRecord, plan: AutomationPlan): string {
  const blueprint = buildAutomationBlueprint(record, plan);
  const argsType = blueprint.parameters.length > 0
    ? `{ ${blueprint.parameters.map((parameter) => `${parameter.name}: ${toArgumentType(parameter.valueType)}`).join("; ")} }`
    : "Record<string, never>";
  const payloadExpression = buildParameterizedBodyExpression(blueprint, "args");
  const hasBody = blueprint.body !== null && blueprint.body !== undefined && !["GET", "HEAD", "OPTIONS"].includes(blueprint.method);
  const method = blueprint.method.toLowerCase();

  return `import axios from "axios";\n\nfunction setValueAtPath(target: unknown, path: string, value: unknown): void {\n  if (!target || typeof target !== "object") {\n    return;\n  }\n  const segments = path.split(".").filter(Boolean);\n  let current = target as Record<string, unknown>;\n  for (const [index, segment] of segments.entries()) {\n    const isLast = index === segments.length - 1;\n    if (isLast) {\n      current[segment] = value;\n      return;\n    }\n    const existing = current[segment];\n    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {\n      current[segment] = {};\n    }\n    current = current[segment] as Record<string, unknown>;\n  }\n}\n\n${buildTsExtractionHelpers(blueprint)}\n\nexport async function ${blueprint.functionName}(args: ${argsType}) {\n  const payload = ${payloadExpression};\n  const response = ${hasBody ? `await axios.${method}(\`<BASE_URL>${blueprint.path}\`, payload, { headers: ${stableStringify(blueprint.headers)} })` : `await axios.${method}(\`<BASE_URL>${blueprint.path}\`, { headers: ${stableStringify(blueprint.headers)} })`};\n  return {\n    status: response.status,\n    ok: response.status >= 200 && response.status < 300,\n    data: extractAutomationResult(response.data)\n  };\n}\n`;
}

function renderHttpxAutomation(record: RequestRecord, plan: AutomationPlan): string {
  const blueprint = buildAutomationBlueprint(record, plan);
  const payload = stableStringify(blueprint.body ?? null)
    .replace(/\btrue\b/g, "True")
    .replace(/\bfalse\b/g, "False")
    .replace(/\bnull\b/g, "None");
  const argsBlock = blueprint.parameters.map((parameter) => `    set_value_at_path(payload, ${JSON.stringify(parameter.path)}, args.get(${JSON.stringify(parameter.name)}))`).join("\n");
  return `import json\nimport re\nimport httpx\n\n${buildPythonExtractionHelpers(blueprint)}\n\ndef set_value_at_path(target, path, value):\n    if value is None:\n        return\n    current = target\n    segments = [segment for segment in path.split('.') if segment]\n    for index, segment in enumerate(segments):\n        is_last = index == len(segments) - 1\n        if is_last:\n            current[segment] = value\n            return\n        current = current.setdefault(segment, {})\n\nasync def ${blueprint.functionName}(args):\n    payload = ${payload}\n${argsBlock || '    payload = payload'}\n    async with httpx.AsyncClient(base_url="<BASE_URL>") as client:\n        response = await client.request(${JSON.stringify(blueprint.method)}, ${JSON.stringify(blueprint.path)}, json=payload, headers=${stableStringify(blueprint.headers)})\n        try:\n            response_body = response.json()\n        except json.JSONDecodeError:\n            response_body = response.text\n        return {\n            "status": response.status_code,\n            "ok": response.is_success,\n            "data": extract_automation_result(response_body, response.text)\n        }\n`;
}

function renderCurlAutomation(record: RequestRecord, plan: AutomationPlan): string {
  const blueprint = buildAutomationBlueprint(record, plan);
  const payloadExpression = buildParameterizedBodyExpression(blueprint, "args");
  return `# Automação inteligente em shell requer interpolação manual.\n# Função sugerida: ${blueprint.functionName}\n# Payload base parametrizado:\n${payloadExpression}\n# Extrações configuradas: ${blueprint.extractions.map((item) => item.key).join(", ") || "nenhuma"}\ncurl -X ${blueprint.method} \"<BASE_URL>${blueprint.path}\"\n`;
}

function getFileName(record: RequestRecord, plan: AutomationPlan, format: ExportFormat): string {
  const safeName = plan.functionName.replace(/[^a-zA-Z0-9_-]+/g, "-");
  const extension = format === "httpx" ? "py" : format === "curl" ? "sh" : "ts";
  return `automation-${record.request.id}-${safeName}.${extension}`;
}

export async function exportSmartArtifacts(records: RequestRecord[], config: AppConfig, format: ExportFormat = "fetch"): Promise<ExportArtifact[]> {
  const outputDir = path.join(config.outputDirectory, "exports", "smart", format);
  const artifacts: ExportArtifact[] = [];

  for (const record of records) {
    const plan = record.automationPlan ?? buildAutomationPlan(record);
    const content = format === "axios"
      ? renderAxiosAutomation(record, plan)
      : format === "httpx"
        ? renderHttpxAutomation(record, plan)
        : format === "curl"
          ? renderCurlAutomation(record, plan)
          : renderTsAutomation(record, plan);
    const filePath = path.join(outputDir, getFileName(record, plan, format));
    await saveText(filePath, content);
    artifacts.push({
      format: `smart-${format}`,
      filePath,
      requestId: record.request.id,
      content,
      automation: true
    });
  }

  return artifacts;
}
