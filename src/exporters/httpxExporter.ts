import path from "node:path";

import type { AppConfig } from "../types/config";
import type { ExportArtifact, RequestRecord } from "../types/network";
import { saveText } from "../storage/saveJson";
import { buildExportHeaders } from "./shared";

function toPythonLiteral(value: unknown): string {
  return JSON.stringify(value, (_key, val: unknown) => val, 2)
    .replace(/\btrue\b/g, "True")
    .replace(/\bfalse\b/g, "False")
    .replace(/\bnull\b/g, "None");
}

export async function exportHttpxArtifacts(records: RequestRecord[], config: AppConfig): Promise<ExportArtifact[]> {
  const outputDir = path.join(config.outputDirectory, "exports", "httpx");
  const artifacts: ExportArtifact[] = [];

  for (const record of records) {
    const url = new URL(record.request.url);
    const headers = toPythonLiteral(buildExportHeaders(record.request.headers));
    const payload = record.request.body === null || record.request.body === undefined ? "None" : toPythonLiteral(record.request.body);
    const snippet = `import httpx

payload = ${payload}

async def call_api() -> None:
    async with httpx.AsyncClient(base_url="<BASE_URL>") as client:
        response = await client.request(
            "${record.request.method}",
            "${url.pathname}${url.search}",
            json=payload,
            headers=${headers}
        )
        print(response.status_code)
`;
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
