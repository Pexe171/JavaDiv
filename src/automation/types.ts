export type ParameterValueType = "string" | "number" | "boolean" | "currency" | "date" | "document" | "identifier" | "unknown";
export type ExtractionStrategy = "json-path" | "regex";
export type ExtractionValueType = "string" | "number" | "currency" | "date" | "boolean" | "unknown";

export interface ParameterCandidate {
  path: string;
  suggestedName: string;
  sampleValue: string;
  valueType: ParameterValueType;
  confidence: number;
  reason: string;
  enabled: boolean;
}

export interface ExtractionCandidate {
  key: string;
  label: string;
  sampleValue: string;
  strategy: ExtractionStrategy;
  selector: string;
  valueType: ExtractionValueType;
  confidence: number;
  reason: string;
  enabled: boolean;
}

export interface AutomationPlan {
  functionName: string;
  parameterCandidates: ParameterCandidate[];
  extractionCandidates: ExtractionCandidate[];
  generatedAt: string;
}

export interface AutomationBlueprintParameter {
  name: string;
  path: string;
  valueType: ParameterValueType;
}

export interface AutomationBlueprintExtraction {
  key: string;
  strategy: ExtractionStrategy;
  selector: string;
  valueType: ExtractionValueType;
}

export interface AutomationBlueprint {
  functionName: string;
  method: string;
  path: string;
  requestContentType?: string | undefined;
  responseContentType?: string | undefined;
  headers: Record<string, string>;
  body: unknown;
  parameters: AutomationBlueprintParameter[];
  extractions: AutomationBlueprintExtraction[];
}
