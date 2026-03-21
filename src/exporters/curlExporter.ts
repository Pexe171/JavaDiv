import path from "node:path";

import type { AppConfig } from "../types/config";
import type { ExportArtifact, RequestRecord } from "../types/network";
import { saveText } from "../storage/saveJson";
import { stableStringify } from "../utils/json";
import { exportSmartArtifacts } from "./smartExporter";
import { buildExportHeaders } from "./shared";

function buildHeaderLines(headers: Record<string, string>): string[] {
  const sanitized = buildExportHeaders(headers);
  return Object.entries(sanitized).map(([key, value]) => `-H "${key}: ${value}"`);
}

function escapeShellPayload(body: unknown): string {
  return stableStringify(body).replace(/'/g, `"'"'"`);
}

export async function exportCurlArtifacts(records: RequestRecord[], config: AppConfig): Promise<ExportArtifact[]> {
  const automationRecords = records.filter((record) => record.automationPlan);
  const classicRecords = records.filter((record) => !record.automationPlan);
  const artifacts: ExportArtifact[] = [];

  if (automationRecords.length > 0) {
    artifacts.push(...await exportSmartArtifacts(automationRecords, config, "curl"));
  }

  const outputDir = path.join(config.outputDirectory, "exports", "curl");
  for (const record of classicRecords) {
    const url = new URL(record.request.url);
    const headers = buildHeaderLines(record.request.headers).join(" ");
    const dataFlag = record.request.body === null || record.request.body === undefined ? "" : ` --data-raw '${escapeShellPayload(record.request.body)}'`;
    const snippet = `curl -X ${record.request.method} "<BASE_URL>${url.pathname}${url.search}" ${headers}${dataFlag}\n`;
    const filePath = path.join(outputDir, `request-${record.request.id}.sh`);
    await saveText(filePath, snippet);
    artifacts.push({
      format: "curl",
      filePath,
      requestId: record.request.id,
      content: snippet
    });
  }

  return artifacts;
}
