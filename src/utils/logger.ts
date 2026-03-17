import type { RequestRecord } from "../types/network";

import { formatDuration } from "./time";

export class Logger {
  public constructor(private readonly debugEnabled: boolean) {}

  public info(message: string): void {
    console.log(`[INFO] ${message}`);
  }

  public warn(message: string): void {
    console.warn(`[WARN] ${message}`);
  }

  public error(message: string, error?: unknown): void {
    console.error(`[ERROR] ${message}`);
    if (error && this.debugEnabled) {
      console.error(error);
    }
  }

  public debug(message: string): void {
    if (this.debugEnabled) {
      console.log(`[DEBUG] ${message}`);
    }
  }

  public logRequest(record: RequestRecord): void {
    const status = record.response?.status ?? "ERR";
    const flowName = record.flowName ?? "unassigned";
    console.log(`[${record.relevance}] ${record.request.method} ${record.request.pathname} -> ${status} in ${formatDuration(record.response?.durationMs ?? 0)} [flow: ${flowName}]`);

    if (!this.debugEnabled) {
      return;
    }

    if (record.request.bodyPreview) {
      console.log(`  request preview: ${record.request.bodyPreview}`);
    }
    if (record.response?.bodyPreview) {
      console.log(`  response preview: ${record.response.bodyPreview}`);
    }
    if (record.scoreReasons.length > 0) {
      console.log(`  score reasons: ${record.scoreReasons.join("; ")}`);
    }
    if (record.autoObservations.length > 0) {
      console.log(`  observations: ${record.autoObservations.join("; ")}`);
    }
  }

  public logIgnoredRequest(method: string, url: string, reasons: string[]): void {
    if (!this.debugEnabled) {
      return;
    }

    console.log(`[DEBUG] Ignored ${method} ${url} -> ${reasons.join("; ")}`);
  }
}
