import type { AppConfig } from "../types/config";
import type { FlowGroup } from "../types/flow";
import type { RequestRecord, RelevanceScore } from "../types/network";

import { toSafeFileSegment } from "../utils/time";

const mutableMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const relevanceRank: Record<RelevanceScore, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

export class FlowGrouper {
  private readonly flows: FlowGroup[] = [];

  public constructor(private readonly config: AppConfig) {}

  public reset(): void {
    this.flows.length = 0;
  }

  public assign(record: RequestRecord): FlowGroup {
    const routeContext = this.normalizeRoute(record.request.pageUrl ?? record.request.frameUrl ?? record.request.pathname);
    const inferredName = this.inferFlowName(record);
    const lastFlow = this.flows.at(-1);
    const requestTime = Date.parse(record.request.timestamp);

    let targetFlow = lastFlow;
    if (!targetFlow || this.shouldStartNewFlow(targetFlow, routeContext, inferredName, requestTime)) {
      targetFlow = {
        id: `flow-${record.request.sequence}-${toSafeFileSegment(inferredName)}`,
        name: inferredName,
        routeContext,
        startedAt: record.request.timestamp,
        endedAt: record.request.timestamp,
        requestIds: [],
        inferredActions: [],
        notes: [],
        relevance: record.relevance,
        statistics: {
          totalRequests: 0,
          mutableRequests: 0,
          highPriorityRequests: 0,
          failedRequests: 0
        }
      };
      this.flows.push(targetFlow);
    }

    targetFlow.endedAt = record.request.timestamp;
    targetFlow.requestIds.push(record.request.id);
    const action = this.inferAction(record);
    if (!targetFlow.inferredActions.includes(action)) {
      targetFlow.inferredActions.push(action);
    }
    targetFlow.relevance = relevanceRank[record.relevance] > relevanceRank[targetFlow.relevance] ? record.relevance : targetFlow.relevance;
    targetFlow.statistics.totalRequests += 1;
    if (mutableMethods.has(record.request.method)) {
      targetFlow.statistics.mutableRequests += 1;
    }
    if (record.relevance === "HIGH") {
      targetFlow.statistics.highPriorityRequests += 1;
    }
    if ((record.response?.status ?? 0) >= 400 || record.response?.error) {
      targetFlow.statistics.failedRequests += 1;
    }

    record.flowId = targetFlow.id;
    record.flowName = targetFlow.name;
    return targetFlow;
  }

  public group(records: RequestRecord[]): { records: RequestRecord[]; flows: FlowGroup[] } {
    this.reset();
    const sorted = [...records].sort((left, right) => left.request.sequence - right.request.sequence);
    for (const record of sorted) {
      this.assign(record);
    }
    return {
      records: sorted,
      flows: this.getFlows()
    };
  }

  public getFlows(): FlowGroup[] {
    return this.flows.map((flow) => ({
      ...flow,
      requestIds: [...flow.requestIds],
      inferredActions: [...flow.inferredActions],
      notes: [...flow.notes],
      statistics: { ...flow.statistics }
    }));
  }

  private shouldStartNewFlow(flow: FlowGroup, routeContext: string, inferredName: string, requestTime: number): boolean {
    const delta = requestTime - Date.parse(flow.endedAt);
    if (delta > this.config.flowTimeWindowMs) {
      return true;
    }

    if (routeContext !== flow.routeContext && delta > this.config.flowTimeWindowMs / 3) {
      return true;
    }

    if (inferredName !== flow.name && delta > 1500) {
      return true;
    }

    return false;
  }

  private inferFlowName(record: RequestRecord): string {
    const content = `${record.request.pathname} ${record.request.url}`.toLowerCase();

    if (/(login|signin|auth|oauth|token)/.test(content)) {
      return "login";
    }
    if (/(search|lookup|customer|cliente|contact)/.test(content)) {
      return "customer-search";
    }
    if (/(simulation|simulate|quote|pricing|calc)/.test(content)) {
      return "simulation";
    }
    if (/(proposal|proposta|submit|save|create|contract)/.test(content)) {
      return "proposal-submit";
    }
    if (/(upload|document|arquivo|attachment)/.test(content)) {
      return "upload-documents";
    }
    if (/(confirm|finish|complete|approval|final)/.test(content)) {
      return "finalization";
    }

    const segments = record.request.pathname.split("/").filter(Boolean).slice(0, 2);
    return segments.length > 0 ? segments.join("-") : "general-flow";
  }

  private inferAction(record: RequestRecord): string {
    if (mutableMethods.has(record.request.method)) {
      return `mutating ${record.request.method.toLowerCase()} call`;
    }
    if (record.request.method === "GET") {
      return "bootstrap or lookup";
    }
    return "auxiliary request";
  }

  private normalizeRoute(route: string): string {
    try {
      const parsed = new URL(route);
      return parsed.pathname || "/";
    } catch {
      return route || "/";
    }
  }
}
