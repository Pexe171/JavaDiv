import type { BrowserContext } from "playwright";
import { promises as fs } from "node:fs";

import type { AppConfig, SessionState } from "../types/config";
import { deleteFileIfExists, fileExists } from "../storage/fileManager";
import { Logger } from "../utils/logger";

interface StoredCookie {
  expires: number;
}

interface StoredOrigin {
  origin: string;
}

interface PersistedStorageState {
  cookies?: StoredCookie[];
  origins?: StoredOrigin[];
}

function hasExpiredSession(cookies: StoredCookie[]): boolean {
  if (cookies.length === 0) {
    return false;
  }

  const nowInSeconds = Date.now() / 1000;
  const persistentCookies = cookies.filter((cookie) => cookie.expires > 0);
  if (persistentCookies.length === 0) {
    return false;
  }

  return persistentCookies.every((cookie) => cookie.expires <= nowInSeconds);
}

export async function inspectSessionState(config: AppConfig): Promise<SessionState> {
  if (!(await fileExists(config.sessionFile))) {
    return {
      sessionFile: config.sessionFile,
      exists: false,
      expired: false,
      cookieCount: 0,
      originCount: 0
    };
  }

  const raw = await fs.readFile(config.sessionFile, "utf-8");
  const parsed = JSON.parse(raw) as PersistedStorageState;
  const stats = await fs.stat(config.sessionFile);
  const cookies = parsed.cookies ?? [];
  const origins = parsed.origins ?? [];

  return {
    sessionFile: config.sessionFile,
    exists: true,
    expired: hasExpiredSession(cookies),
    lastUpdatedAt: stats.mtime.toISOString(),
    cookieCount: cookies.length,
    originCount: origins.length
  };
}

export async function resolveStorageStatePath(config: AppConfig, logger: Logger): Promise<string | undefined> {
  const state = await inspectSessionState(config);
  if (!state.exists) {
    logger.info(`Nenhuma sessão persistida encontrada em ${config.sessionFile}.`);
    return undefined;
  }

  if (state.expired) {
    logger.warn(`Sessão persistida encontrada, mas aparentemente expirada: ${config.sessionFile}`);
    return undefined;
  }

  logger.info(`Restaurando sessão persistida com ${state.cookieCount} cookies.`);
  return config.sessionFile;
}

export async function persistSessionState(context: BrowserContext, config: AppConfig, logger: Logger): Promise<SessionState> {
  if (!config.persistSession) {
    logger.info("Persistência de sessão desativada por configuração.");
    return inspectSessionState(config);
  }

  await context.storageState({ path: config.sessionFile });
  logger.info(`Estado da sessão salvo em ${config.sessionFile}.`);
  return inspectSessionState(config);
}

export async function clearSessionState(config: AppConfig, logger: Logger): Promise<void> {
  await deleteFileIfExists(config.sessionFile);
  logger.info(`Sessão removida em ${config.sessionFile}.`);
}
