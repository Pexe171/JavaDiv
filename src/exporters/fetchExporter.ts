import path from "node:path";

import type { AppConfig } from "../types/config";
import type { ExportArtifact, RequestRecord } from "../types/network";
import { saveText } from "../storage/saveJson";
import { stableStringify } from "../utils/json";
import { buildExportHeaders } from "./shared";

const methodsWithoutBody = new Set(["GET", "HEAD", "OPTIONS"]);

function buildFetchSnippet(record: RequestRecord): string {
  const url = new URL(record.request.url);
  const headers = stableStringify(buildExportHeaders(record.request.headers));
  const requestPath = `${url.pathname}${url.search}`;
  const hasBody = !methodsWithoutBody.has(record.request.method) && record.request.body != null;

  const bodyLine = hasBody ? `  body: JSON.stringify(${stableStringify(record.request.body)}),\n` : "";

  return `const response = await fetch(
  \`<BASE_URL>${requestPath}\`,
  {
    method: "${record.request.method}",
    headers: ${headers},
${bodyLine}  }
);

const data = await response.json();
console.log(response.status, data);
`;
}

export async function exportFetchArtifacts(records: RequestRecord[], config: AppConfig): Promise<ExportArtifact[]> {
  const outputDir = path.join(config.outputDirectory, "exports", "fetch");
  const artifacts: ExportArtifact[] = [];

  for (const record of records) {
    const snippet = buildFetchSnippet(record);
    const filePath = path.join(outputDir, `request-${record.request.id}.ts`);
    await saveText(filePath, snippet);
    artifacts.push({
      format: "fetch",
      filePath,
      requestId: record.request.id,
      content: snippet
    });
  }

  return artifacts;
}
