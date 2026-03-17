import path from "node:path";

import type { AppConfig } from "../types/config";
import type { ExportArtifact, RequestRecord } from "../types/network";
import { saveText } from "../storage/saveJson";
import { stableStringify } from "../utils/json";

function buildHeaders(headers: Record<string, string>): Record<string, string> {
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

function buildPayload(body: unknown): string {
  if (body === null || body === undefined) {
    return "undefined";
  }
  return stableStringify(body);
}

export async function exportAxiosArtifacts(records: RequestRecord[], config: AppConfig): Promise<ExportArtifact[]> {
  const outputDir = path.join(config.outputDirectory, "exports", "axios");
  const artifacts: ExportArtifact[] = [];

  for (const record of records) {
    const url = new URL(record.request.url);
    const method = record.request.method.toLowerCase();
    const headers = stableStringify(buildHeaders(record.request.headers));
    const payload = buildPayload(record.request.body);
    const requestPath = `${url.pathname}${url.search}`;
    const snippet = `import axios from "axios";

const payload = ${payload};

await axios.${method}(
  \`<BASE_URL>${requestPath}\`,
  payload,
  {
    headers: ${headers}
  }
);
`;
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
