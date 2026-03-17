import path from "node:path";
import { Command } from "commander";

import { initBrowser } from "../browser/initBrowser";
import { clearSessionState, persistSessionState } from "../browser/sessionManager";
import { loadAppConfig, withSessionProfile } from "../config/defaultConfig";
import { flowGroupSchema, requestRecordSchema } from "../config/schema";
import { exportAxiosArtifacts } from "../exporters/axiosExporter";
import { exportCurlArtifacts } from "../exporters/curlExporter";
import { buildSessionSummary, saveJsonSummary, saveMarkdownSummary, type SessionSummary } from "../exporters/markdownReporter";
import { exportHttpxArtifacts } from "../exporters/httpxExporter";
import { FlowGrouper } from "../network/flowGrouper";
import { NetworkInterceptor } from "../network/interceptor";
import { ensureRuntimeDirectories, listJsonFiles, readJsonFile, toAbsolutePath } from "../storage/fileManager";
import { saveJson } from "../storage/saveJson";
import type { AppConfig } from "../types/config";
import type { FlowGroup } from "../types/flow";
import type { RequestRecord } from "../types/network";
import { Logger } from "../utils/logger";
import { toSafeFileSegment } from "../utils/time";
import { parseKeyValueEntries, toIdSet } from "./args";

interface CommonOptions {
  debug?: boolean | undefined;
  profile?: string | undefined;
}

async function loadRuntimeConfig(options: CommonOptions & { clearSession?: boolean | undefined }): Promise<{ config: AppConfig; logger: Logger }> {
  const baseConfig = await loadAppConfig({
    debug: Boolean(options.debug),
    clearSessionOnStart: Boolean(options.clearSession)
  });
  const config = withSessionProfile(baseConfig, options.profile ?? "default");
  const logger = new Logger(config.debug);
  await ensureRuntimeDirectories(config);
  return { config, logger };
}

async function loadRequestRecords(inputDirectory: string): Promise<RequestRecord[]> {
  const directory = toAbsolutePath(inputDirectory);
  const files = await listJsonFiles(directory);
  const records: RequestRecord[] = [];

  for (const filePath of files) {
    const parsed = await readJsonFile<unknown>(filePath);
    if (!parsed) {
      continue;
    }
    records.push(requestRecordSchema.parse(parsed) as RequestRecord);
  }

  return records.sort((left, right) => left.request.sequence - right.request.sequence);
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
  records: RequestRecord[],
  flows: FlowGroup[],
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

async function persistSessionArtifacts(
  records: RequestRecord[],
  flows: FlowGroup[],
  config: AppConfig,
  targetUrl: string
): Promise<SessionSummary> {
  const initialSummary = buildSessionSummary(records, flows, []);
  const requestFiles = await persistRequestFiles(records, config);
  const flowFiles = await persistFlowFiles(flows, config, initialSummary.sessionId);
  const sessionFilePath = path.join(config.outputDirectory, "sessions", `${initialSummary.sessionId}.json`);
  const generatedFiles = [...requestFiles, ...flowFiles, sessionFilePath];
  const finalized = await finalizeSummary(initialSummary, records, flows, generatedFiles, config);
  const completeGeneratedFiles = [...generatedFiles, finalized.reportPath, finalized.markdownPath];
  const finalSummary = {
    ...finalized.summary,
    generatedFiles: completeGeneratedFiles
  };

  await saveJson(finalized.reportPath, finalSummary);
  await saveJson(
    sessionFilePath,
    {
      sessionId: finalSummary.sessionId,
      createdAt: finalSummary.createdAt,
      targetUrl,
      requestCount: records.length,
      flowCount: flows.length,
      requestFiles,
      flowFiles,
      reportFiles: [finalized.reportPath, finalized.markdownPath],
      generatedFiles: completeGeneratedFiles
    }
  );

  return finalSummary;
}

function waitForCaptureStop(browserClosePromise: Promise<void>, logger: Logger): Promise<"signal" | "browser_closed"> {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (reason: "signal" | "browser_closed") => {
      if (settled) {
        return;
      }
      settled = true;
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      resolve(reason);
    };

    const onSignal = () => {
      logger.info("Sinal recebido; finalizando captura e persistindo artefatos.");
      finish("signal");
    };

    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);

    void browserClosePromise.then(() => finish("browser_closed"));
  });
}

async function runStartCommand(targetUrl: string, options: { debug?: boolean; profile?: string; clearSession?: boolean }): Promise<void> {
  const { config, logger } = await loadRuntimeConfig(options);
  if (options.clearSession || config.clearSessionOnStart) {
    await clearSessionState(config, logger);
  }

  const browserSession = await initBrowser({
    targetUrl,
    config,
    logger
  });

  const interceptor = new NetworkInterceptor(config, logger);
  interceptor.attachToContext(browserSession.context);
  logger.info(`Abrindo Chromium visível em ${targetUrl}`);
  await browserSession.page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  logger.info("Faça login manualmente no ambiente autorizado. Use Ctrl+C no terminal para encerrar a captura com segurança.");

  const browserClosedPromise = new Promise<void>((resolve) => {
    browserSession.browser.on("disconnected", () => resolve());
  });
  const stopReason = await waitForCaptureStop(browserClosedPromise, logger);

  if (stopReason === "signal" && browserSession.browser.isConnected()) {
    try {
      await persistSessionState(browserSession.context, config, logger);
    } catch (error) {
      logger.warn(`Não foi possível persistir a sessão antes do encerramento: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      await browserSession.browser.close();
    } catch (error) {
      logger.debug(`Falha ignorada ao fechar browser: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const records = interceptor.getRecords();
  const flows = interceptor.getFlows();
  const summary = await persistSessionArtifacts(records, flows, config, targetUrl);
  logger.info(`Sessão ${summary.sessionId} finalizada com ${summary.totalRequestsObserved} requests observadas.`);
}

function applyManualAdjustments(
  records: RequestRecord[],
  importantIds: Set<string>,
  notesByRequestId: Map<string, string>
): RequestRecord[] {
  return records.map((record) => {
    const updatedRecord: RequestRecord = {
      ...record,
      scoreReasons: [...record.scoreReasons],
      autoObservations: [...record.autoObservations],
      notes: [...record.notes]
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

function renameFlows(flows: FlowGroup[], records: RequestRecord[], renameMap: Map<string, string>): void {
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

async function runAnalyzeCommand(
  inputDirectory: string,
  options: { debug?: boolean; important?: string[]; note?: string[]; renameFlow?: string[] }
): Promise<void> {
  const { config, logger } = await loadRuntimeConfig({ debug: options.debug });
  const records = await loadRequestRecords(inputDirectory);
  const importantIds = toIdSet(options.important);
  const noteMap = parseKeyValueEntries(options.note);
  const renameMap = parseKeyValueEntries(options.renameFlow);
  const updatedRecords = applyManualAdjustments(records, importantIds, noteMap);
  const grouper = new FlowGrouper(config);
  const grouped = grouper.group(updatedRecords);
  renameFlows(grouped.flows, grouped.records, renameMap);
  await persistSessionArtifacts(grouped.records, grouped.flows, config, "offline-analysis");
  logger.info(`Análise concluída com ${grouped.records.length} requests reprocessadas.`);
}

async function runExportCommand(
  options: { format: string; input?: string; requestId?: string[]; debug?: boolean }
): Promise<void> {
  const { config, logger } = await loadRuntimeConfig({ debug: options.debug });
  const records = await loadRequestRecords(options.input ?? path.join(config.outputDirectory, "requests"));
  const requestedIds = toIdSet(options.requestId);
  const filteredRecords = requestedIds.size > 0 ? records.filter((record) => requestedIds.has(record.request.id)) : records.filter((record) => record.relevant);

  if (filteredRecords.length === 0) {
    logger.warn("Nenhuma request elegível para exportação foi encontrada.");
    return;
  }

  if (options.format === "axios") {
    await exportAxiosArtifacts(filteredRecords, config);
  } else if (options.format === "httpx") {
    await exportHttpxArtifacts(filteredRecords, config);
  } else if (options.format === "curl") {
    await exportCurlArtifacts(filteredRecords, config);
  } else {
    throw new Error(`Formato de exportação não suportado: ${options.format}`);
  }

  logger.info(`Exportação ${options.format} concluída para ${filteredRecords.length} request(s).`);
}

async function runReportCommand(inputDirectory: string | undefined, options: { debug?: boolean }): Promise<void> {
  const { config, logger } = await loadRuntimeConfig({ debug: options.debug });
  const records = await loadRequestRecords(inputDirectory ?? path.join(config.outputDirectory, "requests"));
  const grouped = new FlowGrouper(config).group(records);
  const summary = await persistSessionArtifacts(grouped.records, grouped.flows, config, "report-only");
  logger.info(`Relatório ${summary.sessionId} gerado com ${summary.totalRequestsObserved} requests.`);
}

async function runClearSessionCommand(options: { debug?: boolean; profile?: string }): Promise<void> {
  const { config, logger } = await loadRuntimeConfig(options);
  await clearSessionState(config, logger);
}

export function createCli(): Command {
  const program = new Command();
  program
    .name("http-observe")
    .description("Ferramenta segura para inspeção, auditoria e análise de tráfego HTTP em ambientes autorizados.")
    .version("0.1.0");

  program
    .command("start")
    .description("Abre o Chromium visível, restaura sessão autorizada e captura tráfego relevante.")
    .requiredOption("-t, --target <url>", "URL alvo autorizada")
    .option("-p, --profile <name>", "Perfil da sessão", "default")
    .option("--clear-session", "Limpa a sessão antes de iniciar")
    .option("--debug", "Ativa logs detalhados")
    .action(async (options) => runStartCommand(options.target, options));

  program
    .command("analyze <inputDirectory>")
    .description("Reprocessa requests salvas, reagrupa fluxos e aplica anotações manuais.")
    .option("--important <ids...>", "Marca request IDs como importantes")
    .option("--note <entries...>", "Adiciona notas no formato requestId:nota")
    .option("--rename-flow <entries...>", "Renomeia fluxos no formato flowId:novo-nome")
    .option("--debug", "Ativa logs detalhados")
    .action(async (inputDirectory, options) => runAnalyzeCommand(inputDirectory, options));

  program
    .command("export")
    .description("Gera artefatos sanitizados para integração legítima.")
    .requiredOption("--format <format>", "Formato: axios, httpx ou curl")
    .option("--input <directory>", "Diretório com request JSONs")
    .option("--request-id <ids...>", "Exporta apenas request IDs específicos")
    .option("--debug", "Ativa logs detalhados")
    .action(async (options) => runExportCommand(options));

  program
    .command("report")
    .description("Gera sumário JSON e Markdown com base nas requests persistidas.")
    .argument("[inputDirectory]", "Diretório com request JSONs")
    .option("--debug", "Ativa logs detalhados")
    .action(async (inputDirectory, options) => runReportCommand(inputDirectory, options));

  program
    .command("clear-session")
    .description("Remove o storageState persistido do perfil informado.")
    .option("-p, --profile <name>", "Perfil da sessão", "default")
    .option("--debug", "Ativa logs detalhados")
    .action(async (options) => runClearSessionCommand(options));

  return program;
}
