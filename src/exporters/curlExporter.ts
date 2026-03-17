import path from "node:path";

import type { AppConfig } from "../types/config";
import type { ExportArtifact, RequestRecord } from "../types/network";
import { saveText } from "../storage/saveJson";
import { stableStringify } from "../utils/json";

function buildHeaderLines(headers: Record<string, string>): string[] {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(headers)) {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey.includes("authorization")) {
      lines.push(`-H "${key}: Bearer <TOKEN>"`);
    } else if (normalizedKey.includes("cookie")) {
      lines.push(`-H "${key}: <COOKIE>"`);
    } else if (normalizedKey.includes("csrf")) {
      lines.push(`-H "${key}: <CSRF>"`);
    } else if (["content-type", "accept", "x-requested-with"].includes(normalizedKey)) {
      lines.push(`-H "${key}: ${value}"`);
    }
  }
  return lines;
}

function escapeShellPayload(body: unknown): string {
  return stableStringify(body).replace(/'/g, `'"'"'`);
}

export async function exportCurlArtifacts(records: RequestRecord[], config: AppConfig): Promise<ExportArtifact[]> {
  const outputDir = path.join(config.outputDirectory, "exports", "curl");
  const artifacts: ExportArtifact[] = [];

  for (const record of records) {
    const url = new URL(record.request.url);
    const headers = buildHeaderLines(record.request.headers).join(" ");
    const dataFlag = record.request.body === null || record.request.body === undefined ? "" : ` --data-raw '${escapeShellPayload(record.request.body)}'`;
    const snippet = `curl -X ${record.request.method} "<BASE_URL>${url.pathname}${url.search}" ${headers}${dataFlag}
`;
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
