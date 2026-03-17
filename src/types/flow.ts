import type { RelevanceScore } from "./network";

export interface FlowGroup {
  id: string;
  name: string;
  domainStage?: string | undefined;
  primaryDefinitionId?: string | undefined;
  routeContext: string;
  startedAt: string;
  endedAt: string;
  requestIds: string[];
  inferredActions: string[];
  notes: string[];
  relevance: RelevanceScore;
  statistics: {
    totalRequests: number;
    mutableRequests: number;
    highPriorityRequests: number;
    failedRequests: number;
  };
}
