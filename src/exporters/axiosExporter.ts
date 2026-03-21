import path from "node:path";

import type { AppConfig } from "../types/config";
import type { ExportArtifact, RequestRecord } from "../types/network";
import { saveText } from "../storage/saveJson";
import { stableStringify } from "../utils/json";
import { exportSmartArtifacts } from "./smartExporter";
import { buildExportHeaders } from "./shared";

function buildPayload(body: unknown): string {
  if (body === null || body === undefined) {
    return "undefined";
  }
  return stableStringify(body);
}

const methodsWithoutBody = new Set(["GET", "HEAD", "OPTIONS"]);

function buildAxiosSnippet(record: RequestRecord): string {
  const url = new URL(record.request.url);
  const method = record.request.method.toLowerCase();
  const headers = stableStringify(buildExportHeaders(record.request.headers));
  const requestPath = `${url.pathname}${url.search}`;

  if (methodsWithoutBody.has(record.request.method)) {
    return `import axios from "axios";\n\nawait axios.${method}(\n  \`<BASE_URL>${requestPath}\`,\n  {\n    headers: ${headers}\n  }\n);\n`;
  }

  const payload = buildPayload(record.request.body);
  return `import axios from "axios";\n\nconst payload = ${payload};\n\nawait axios.${method}(\n  \`<BASE_URL>${requestPath}\`,\n  payload,\n  {\n    headers: ${headers}\n  }\n);\n`;
}

export async function exportAxiosArtifacts(records: RequestRecord[], config: AppConfig): Promise<ExportArtifact[]> {
  const automationRecords = records.filter((record) => record.automationPlan);
  const classicRecords = records.filter((record) => !record.automationPlan);
  const artifacts: ExportArtifact[] = [];

  if (automationRecords.length > 0) {
    artifacts.push(...await exportSmartArtifacts(automationRecords, config, "axios"));
  }

  const outputDir = path.join(config.outputDirectory, "exports", "axios");
  for (const record of classicRecords) {
    const snippet = buildAxiosSnippet(record);
    const filePath = path.join(outputDir, `request-${record.request.id}.ts`);
    await saveText(filePath, snippet);
    artifacts.push({
      format: "axios",
      filePath,
      requestId: record.request.id,
      content: snippet
    });
  }

  return artifacts;
}
