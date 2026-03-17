import type { BrowserContext, Page, Request } from "playwright";

import type { AppConfig } from "../types/config";
import type { CapturedRequest, RequestRecord } from "../types/network";
import { Logger } from "../utils/logger";
import { FlowGrouper } from "./flowGrouper";
import { RequestClassifier } from "./requestClassifier";
import { RequestParser } from "./requestParser";
import { NetworkRedactor } from "./redactor";

interface PendingCapture {
  parsedRequest: CapturedRequest;
  startedAt: number;
}

export class NetworkInterceptor {
  private readonly pending = new Map<Request, PendingCapture>();
  private readonly records: RequestRecord[] = [];
  private readonly attachedPages = new WeakSet<Page>();
  private readonly parser: RequestParser;
  private readonly classifier: RequestClassifier;
  private readonly flowGrouper: FlowGrouper;
  private sequence = 0;

  public constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger
  ) {
    const redactor = new NetworkRedactor(config);
    this.parser = new RequestParser(config, redactor);
    this.classifier = new RequestClassifier(config);
    this.flowGrouper = new FlowGrouper(config);
  }

  public attachToContext(context: BrowserContext): void {
    for (const page of context.pages()) {
      this.attachPage(page);
    }

    context.on("page", (page) => this.attachPage(page));
  }

  public getRecords(): RequestRecord[] {
    return this.records.map((record) => ({
      ...record,
      request: {
        ...record.request,
        headers: { ...record.request.headers },
        queryParams: { ...record.request.queryParams }
      },
      response: record.response
        ? {
            ...record.response,
            headers: { ...record.response.headers }
          }
        : undefined,
      scoreReasons: [...record.scoreReasons],
      autoObservations: [...record.autoObservations],
      notes: [...record.notes]
    }));
  }

  public getFlows() {
    return this.flowGrouper.getFlows();
  }

  private attachPage(page: Page): void {
    if (this.attachedPages.has(page)) {
      return;
    }

    this.attachedPages.add(page);
    page.on("request", (request) => this.handleRequest(request));
    page.on("requestfinished", (request) => {
      void this.handleRequestFinished(request);
    });
    page.on("requestfailed", (request) => {
      this.handleRequestFailed(request);
    });
  }

  private handleRequest(request: Request): void {
    const decision = this.parser.shouldCaptureRequest(request);
    if (!decision.capture) {
      this.logger.logIgnoredRequest(request.method(), request.url(), decision.reasons);
      return;
    }

    const parsedRequest = this.parser.parseRequest(request, ++this.sequence);
    this.pending.set(request, {
      parsedRequest,
      startedAt: Date.now()
    });
  }

  private async handleRequestFinished(request: Request): Promise<void> {
    const pendingCapture = this.pending.get(request);
    if (!pendingCapture) {
      return;
    }

    try {
      const response = await request.response();
      const parsedResponse = await this.parser.parseResponse(response, pendingCapture.startedAt);
      const baseRecord: RequestRecord = {
        request: pendingCapture.parsedRequest,
        response: parsedResponse,
        relevance: "LOW",
        scoreValue: 0,
        scoreReasons: [],
        relevant: false,
        domainSignals: [],
        autoObservations: [],
        manuallyImportant: false,
        notes: []
      };

      const classification = this.classifier.classify(baseRecord, this.records.slice(-10));
      baseRecord.relevance = classification.label;
      baseRecord.scoreValue = classification.score;
      baseRecord.scoreReasons = classification.reasons;
      baseRecord.relevant = classification.relevant;
      baseRecord.autoObservations = classification.observations;

      const flow = this.flowGrouper.assign(baseRecord);
      baseRecord.flowId = flow.id;
      baseRecord.flowName = flow.name;

      this.records.push(baseRecord);
      this.logger.logRequest(baseRecord);
    } finally {
      this.pending.delete(request);
    }
  }

  private handleRequestFailed(request: Request): void {
    const pendingCapture = this.pending.get(request);
    if (!pendingCapture) {
      return;
    }

    try {
      const failure = request.failure();
      const errorText = failure?.errorText ?? "unknown_request_failure";
      const failedResponse = this.parser.buildFailedResponse(errorText, pendingCapture.startedAt);
      const baseRecord: RequestRecord = {
        request: pendingCapture.parsedRequest,
        response: failedResponse,
        relevance: "LOW",
        scoreValue: 0,
        scoreReasons: [],
        relevant: false,
        domainSignals: [],
        autoObservations: ["Request failed before a valid response was received."],
        manuallyImportant: false,
        notes: []
      };

      const classification = this.classifier.classify(baseRecord, this.records.slice(-10));
      baseRecord.relevance = classification.label;
      baseRecord.scoreValue = classification.score;
      baseRecord.scoreReasons = classification.reasons;
      baseRecord.relevant = classification.relevant;
      baseRecord.autoObservations = [...baseRecord.autoObservations, ...classification.observations];

      const flow = this.flowGrouper.assign(baseRecord);
      baseRecord.flowId = flow.id;
      baseRecord.flowName = flow.name;

      this.records.push(baseRecord);
      this.logger.logRequest(baseRecord);
    } finally {
      this.pending.delete(request);
    }
  }
}
