import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

import type { AppConfig } from "../types/config";
import { Logger } from "../utils/logger";
import { resolveStorageStatePath } from "./sessionManager";

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

interface InitBrowserOptions {
  targetUrl: string;
  config: AppConfig;
  logger: Logger;
}

export async function initBrowser(options: InitBrowserOptions): Promise<BrowserSession> {
  const storageState = await resolveStorageStatePath(options.config, options.logger);
  const browser = await chromium.launch({
    headless: false
  });

  const context = await browser.newContext(storageState ? { storageState } : {});
  const page = await context.newPage();

  options.logger.info("Chromium visível iniciado com sucesso.");

  return {
    browser,
    context,
    page
  };
}
