import path from "node:path";

import type { AppConfig } from "../types/config";
import type { ExportArtifact, RequestRecord } from "../types/network";
import { saveText } from "../storage/saveJson";
import { exportSmartArtifacts } from "./smartExporter";
import { buildExportHeaders } from "./shared";

function toPythonLiteral(value: unknown): string {
  return JSON.stringify(value, (_key, val: unknown) => val, 2)
    .replace(/\btrue\b/g, "True")
    .replace(/\bfalse\b/g, "False")
    .replace(/\bnull\b/g, "None");
}

export async function exportHttpxArtifacts(records: RequestRecord[], config: AppConfig): Promise<ExportArtifact[]> {
  const automationRecords = records.filter((record) => record.automationPlan);
  const classicRecords = records.filter((record) => !record.automationPlan);
  const artifacts: ExportArtifact[] = [];

  if (automationRecords.length > 0) {
    artifacts.push(...await exportSmartArtifacts(automationRecords, config, "httpx"));
  }

  const outputDir = path.join(config.outputDirectory, "exports", "httpx");
  for (const record of classicRecords) {
    const url = new URL(record.request.url);
    const headers = toPythonLiteral(buildExportHeaders(record.request.headers));
    const payload = record.request.body === null || record.request.body === undefined ? "None" : toPythonLiteral(record.request.body);
    const snippet = `import httpx\n\npayload = ${payload}\n\nasync def call_api() -> None:\n    async with httpx.AsyncClient(base_url="<BASE_URL>") as client:\n        response = await client.request(\n            ${JSON.stringify(record.request.method)},\n            ${JSON.stringify(`${url.pathname}${url.search}`)},\n            json=payload,\n            headers=${headers}\n        )\n        print(response.status_code)\n`;
    const filePath = path.join(outputDir, `request-${record.request.id}.py`);
    await saveText(filePath, snippet);
    artifacts.push({
      format: "httpx",
      filePath,
      requestId: record.request.id,
      content: snippet
    });
  }

  return artifacts;
}
