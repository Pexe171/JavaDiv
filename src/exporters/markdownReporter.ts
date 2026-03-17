import path from "node:path";

import type { AppConfig } from "../types/config";
import type { FlowGroup } from "../types/flow";
import type { ExportArtifact, RequestRecord } from "../types/network";
import { saveText } from "../storage/saveJson";
import { stableStringify } from "../utils/json";
import { toTimestampId } from "../utils/time";

export interface SessionSummary {
  sessionId: string;
  createdAt: string;
  totalRequestsObserved: number;
  totalRelevantRequests: number;
  topEndpointsByFrequency: Array<{ pathname: string; count: number }>;
  topMutableEndpoints: Array<{ pathname: string; count: number }>;
  flowsDetected: Array<{ id: string; name: string; requests: number }>;
  highPriorityRequests: Array<{ id: string; method: string; pathname: string; status?: number | undefined; flowName?: string | undefined }>;
  httpFailures: Array<{ id: string; pathname: string; status?: number | undefined; error?: string | undefined }>;
  inferredUserActions: string[];
  generatedFiles: string[];
}

function rankByCount(entries: Map<string, number>): Array<{ pathname: string; count: number }> {
  return [...entries.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10)
    .map(([pathname, count]) => ({ pathname, count }));
}

export function buildSessionSummary(records: RequestRecord[], flows: FlowGroup[], generatedFiles: string[]): SessionSummary {
  const frequency = new Map<string, number>();
  const mutable = new Map<string, number>();

  for (const record of records) {
    frequency.set(record.request.pathname, (frequency.get(record.request.pathname) ?? 0) + 1);
    if (["POST", "PUT", "PATCH", "DELETE"].includes(record.request.method)) {
      mutable.set(record.request.pathname, (mutable.get(record.request.pathname) ?? 0) + 1);
    }
  }

  return {
    sessionId: `session-${toTimestampId()}`,
    createdAt: new Date().toISOString(),
    totalRequestsObserved: records.length,
    totalRelevantRequests: records.filter((record) => record.relevant).length,
    topEndpointsByFrequency: rankByCount(frequency),
    topMutableEndpoints: rankByCount(mutable),
    flowsDetected: flows.map((flow) => ({ id: flow.id, name: flow.name, requests: flow.requestIds.length })),
    highPriorityRequests: records
      .filter((record) => record.relevance === "HIGH")
      .map((record) => ({
        id: record.request.id,
        method: record.request.method,
        pathname: record.request.pathname,
        status: record.response?.status,
        flowName: record.flowName
      })),
    httpFailures: records
      .filter((record) => (record.response?.status ?? 0) >= 400 || record.response?.error)
      .map((record) => ({
        id: record.request.id,
        pathname: record.request.pathname,
        status: record.response?.status,
        error: record.response?.error
      })),
    inferredUserActions: [...new Set(flows.flatMap((flow) => flow.inferredActions))],
    generatedFiles
  };
}

export function renderSessionMarkdown(summary: SessionSummary): string {
  const lines = [
    "# Session Summary",
    "",
    `- Session ID: ${summary.sessionId}`,
    `- Created at: ${summary.createdAt}`,
    `- Total requests observed: ${summary.totalRequestsObserved}`,
    `- Total relevant requests: ${summary.totalRelevantRequests}`,
    "",
    "## Top endpoints by frequency",
    ...summary.topEndpointsByFrequency.map((entry) => `- ${entry.pathname}: ${entry.count}`),
    "",
    "## Top mutable endpoints",
    ...summary.topMutableEndpoints.map((entry) => `- ${entry.pathname}: ${entry.count}`),
    "",
    "## Detected flows",
    ...summary.flowsDetected.map((flow) => `- ${flow.name} (${flow.id}): ${flow.requests} request(s)`),
    "",
    "## High priority requests",
    ...summary.highPriorityRequests.map((entry) => `- ${entry.method} ${entry.pathname} -> ${entry.status ?? "n/a"} [flow: ${entry.flowName ?? "unassigned"}]`),
    "",
    "## HTTP failures",
    ...summary.httpFailures.map((entry) => `- ${entry.pathname} -> ${entry.status ?? "n/a"} ${entry.error ? `(${entry.error})` : ""}`),
    "",
    "## Inferred user actions",
    ...summary.inferredUserActions.map((action) => `- ${action}`),
    "",
    "## Generated files",
    ...summary.generatedFiles.map((filePath) => `- ${filePath}`)
  ];

  return `${lines.join("\n")}\n`;
}

export async function saveMarkdownSummary(summary: SessionSummary, config: AppConfig): Promise<ExportArtifact> {
  const filePath = path.join(config.outputDirectory, "exports", "markdown", `${summary.sessionId}.md`);
  const content = renderSessionMarkdown(summary);
  await saveText(filePath, content);
  return {
    format: "markdown",
    filePath,
    content
  };
}

export async function saveJsonSummary(summary: SessionSummary, config: AppConfig): Promise<string> {
  const filePath = path.join(config.outputDirectory, "reports", `${summary.sessionId}.json`);
  await saveText(filePath, `${stableStringify(summary)}\n`);
  return filePath;
}
