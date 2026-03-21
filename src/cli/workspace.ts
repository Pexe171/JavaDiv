import path from "node:path";

import { flowGroupSchema, requestRecordSchema } from "../config/schema";
import { buildSessionSummary, saveJsonSummary, saveMarkdownSummary, type SessionSummary } from "../exporters/markdownReporter";
import { NetworkRedactor } from "../network/redactor";
import { RequestClassifier } from "../network/requestClassifier";
import { FlowGrouper } from "../network/flowGrouper";
import { listJsonFiles, readJsonFile, toAbsolutePath } from "../storage/fileManager";
import { saveJson } from "../storage/saveJson";
import type { AppConfig } from "../types/config";
import type { FlowGroup } from "../types/flow";
import type { RequestRecord } from "../types/network";
import { toSafeFileSegment } from "../utils/time";

export interface AnalysisWorkspace {
  inputDirectory: string;
  records: RequestRecord[];
  flows: FlowGroup[];
}

export async function loadRequestRecords(inputDirectory: string): Promise<RequestRecord[]> {
  const directory = toAbsolutePath(inputDirectory);
  const files = await listJsonFiles(directory);
  const records: RequestRecord[] = [];

  for (const filePath of files) {
    const parsed = await readJsonFile<unknown>(filePath);
    if (!parsed) {
      continue;
    }

    const record = requestRecordSchema.parse(parsed) as RequestRecord;
    if (!record.domainSignals) {
      record.domainSignals = [];
    }
    records.push(record);
  }

  return records.sort((left, right) => left.request.sequence - right.request.sequence);
}

export function regroupRecords(records: RequestRecord[], config: AppConfig): { records: RequestRecord[]; flows: FlowGroup[] } {
  return new FlowGrouper(config).group(records);
}

export function resanitizeRecords(records: RequestRecord[], config: AppConfig): RequestRecord[] {
  const redactor = new NetworkRedactor(config);

  return records.map((record) => {
    const requestBody = redactor.redactStructured(record.request.body, "body", config.requestBodyPreviewLimit, config.maxBodyBytesToStore);
    const responseBody = record.response
      ? redactor.redactStructured(record.response.body, "body", config.responseBodyPreviewLimit, config.maxBodyBytesToStore)
      : undefined;

    return {
      ...record,
      request: {
        ...record.request,
        headers: redactor.sanitizeHeaders(record.request.headers),
        queryParams: redactor.sanitizeQuery(record.request.queryParams),
        body: requestBody.data,
        bodyPreview: requestBody.preview,
        bodyTruncated: requestBody.truncated
      },
      response: record.response
        ? {
            ...record.response,
            headers: redactor.sanitizeHeaders(record.response.headers),
            body: responseBody?.data ?? record.response.body,
            bodyPreview: responseBody?.preview ?? record.response.bodyPreview,
            bodyTruncated: responseBody?.truncated ?? record.response.bodyTruncated
          }
        : undefined,
      notes: [...record.notes],
      scoreReasons: [...record.scoreReasons],
      autoObservations: [...record.autoObservations],
      domainSignals: [...record.domainSignals],
      automationPlan: record.automationPlan
        ? {
            ...record.automationPlan,
            parameterCandidates: record.automationPlan.parameterCandidates.map((candidate) => ({ ...candidate })),
            extractionCandidates: record.automationPlan.extractionCandidates.map((candidate) => ({ ...candidate }))
          }
        : undefined
    };
  });
}

export function reclassifyRecords(records: RequestRecord[], config: AppConfig): RequestRecord[] {
  const classifier = new RequestClassifier(config);
  const sorted = resanitizeRecords(records, config).sort((left, right) => left.request.sequence - right.request.sequence);
  const reclassified: RequestRecord[] = [];

  for (const record of sorted) {
    const updatedRecord: RequestRecord = {
      ...record,
      domainSignals: [],
      scoreReasons: [],
      autoObservations: [],
      notes: [...record.notes],
      automationPlan: record.automationPlan
        ? {
            ...record.automationPlan,
            parameterCandidates: record.automationPlan.parameterCandidates.map((candidate) => ({ ...candidate })),
            extractionCandidates: record.automationPlan.extractionCandidates.map((candidate) => ({ ...candidate }))
          }
        : undefined
    };

    const classification = classifier.classify(updatedRecord, reclassified.slice(-10));
    updatedRecord.relevance = classification.label;
    updatedRecord.scoreValue = classification.score;
    updatedRecord.scoreReasons = [...classification.reasons];
    updatedRecord.relevant = classification.relevant;
    updatedRecord.autoObservations = [...classification.observations];

    if (updatedRecord.manuallyImportant) {
      updatedRecord.relevance = "HIGH";
      updatedRecord.relevant = true;
      if (!updatedRecord.scoreReasons.includes("Marcado manualmente como importante.")) {
        updatedRecord.scoreReasons.push("Marcado manualmente como importante.");
      }
    }

    reclassified.push(updatedRecord);
  }

  return reclassified;
}

export async function loadAnalysisWorkspace(inputDirectory: string, config: AppConfig): Promise<AnalysisWorkspace> {
  const records = reclassifyRecords(await loadRequestRecords(inputDirectory), config);
  const grouped = regroupRecords(records, config);
  return {
    inputDirectory: toAbsolutePath(inputDirectory),
    records: grouped.records,
    flows: grouped.flows
  };
}

export function applyManualAdjustments(
  records: RequestRecord[],
  importantIds: Set<string>,
  notesByRequestId: Map<string, string>
): RequestRecord[] {
  return records.map((record) => {
    const updatedRecord: RequestRecord = {
      ...record,
      domainSignals: [...record.domainSignals],
      scoreReasons: [...record.scoreReasons],
      autoObservations: [...record.autoObservations],
      notes: [...record.notes],
      automationPlan: record.automationPlan
        ? {
            ...record.automationPlan,
            parameterCandidates: record.automationPlan.parameterCandidates.map((candidate) => ({ ...candidate })),
            extractionCandidates: record.automationPlan.extractionCandidates.map((candidate) => ({ ...candidate }))
          }
        : undefined
    };

    if (importantIds.has(record.request.id)) {
      updatedRecord.manuallyImportant = true;
      updatedRecord.relevant = true;
      updatedRecord.relevance = "HIGH";
      if (!updatedRecord.scoreReasons.includes("Marcado manualmente como importante.")) {
        updatedRecord.scoreReasons.push("Marcado manualmente como importante.");
      }
    }

    const note = notesByRequestId.get(record.request.id);
    if (note) {
      updatedRecord.notes.push(note);
    }

    return updatedRecord;
  });
}

export function renameFlows(flows: FlowGroup[], records: RequestRecord[], renameMap: Map<string, string>): void {
  for (const flow of flows) {
    const renamed = renameMap.get(flow.id);
    if (!renamed) {
      continue;
    }

    flow.name = renamed;
    for (const record of records) {
      if (record.flowId === flow.id) {
        record.flowName = renamed;
      }
    }
  }
}

async function persistRequestFiles(records: RequestRecord[], config: AppConfig): Promise<string[]> {
  const files: string[] = [];
  for (const record of records) {
    requestRecordSchema.parse(record);
    const filePath = path.join(config.outputDirectory, "requests", `request-${record.request.id}.json`);
    await saveJson(filePath, record);
    files.push(filePath);
  }
  return files;
}

async function persistFlowFiles(flows: FlowGroup[], config: AppConfig, sessionId: string): Promise<string[]> {
  const files: string[] = [];
  for (const [index, flow] of flows.entries()) {
    flowGroupSchema.parse(flow);
    const filePath = path.join(
      config.outputDirectory,
      "flows",
      `flow-${sessionId}-${String(index + 1).padStart(2, "0")}-${toSafeFileSegment(flow.name)}.json`
    );
    await saveJson(filePath, flow);
    files.push(filePath);
  }
  return files;
}

async function finalizeSummary(
  summary: SessionSummary,
  generatedFiles: string[],
  config: AppConfig
): Promise<{ summary: SessionSummary; reportPath: string; markdownPath: string }> {
  const finalSummary: SessionSummary = {
    ...summary,
    generatedFiles
  };

  const reportPath = await saveJsonSummary(finalSummary, config);
  const markdownArtifact = await saveMarkdownSummary(finalSummary, config);

  return {
    summary: finalSummary,
    reportPath,
    markdownPath: markdownArtifact.filePath
  };
}

export async function persistSessionArtifacts(
  records: RequestRecord[],
  flows: FlowGroup[],
  config: AppConfig,
  sourceLabel: string
): Promise<SessionSummary> {
  const initialSummary = buildSessionSummary(records, flows, []);
  const requestFiles = await persistRequestFiles(records, config);
  const flowFiles = await persistFlowFiles(flows, config, initialSummary.sessionId);
  const sessionFilePath = path.join(config.outputDirectory, "sessions", `${initialSummary.sessionId}.json`);
  const generatedFiles = [...requestFiles, ...flowFiles, sessionFilePath];
  const finalized = await finalizeSummary(initialSummary, generatedFiles, config);
  const completeGeneratedFiles = [...generatedFiles, finalized.reportPath, finalized.markdownPath];
  const finalSummary = {
    ...finalized.summary,
    generatedFiles: completeGeneratedFiles
  };

  await saveJson(finalized.reportPath, finalSummary);
  await saveJson(sessionFilePath, {
    sessionId: finalSummary.sessionId,
    createdAt: finalSummary.createdAt,
    targetUrl: sourceLabel,
    requestCount: records.length,
    flowCount: flows.length,
    requestFiles,
    flowFiles,
    reportFiles: [finalized.reportPath, finalized.markdownPath],
    generatedFiles: completeGeneratedFiles
  });

  return finalSummary;
}
