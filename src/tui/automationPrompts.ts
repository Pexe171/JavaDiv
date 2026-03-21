import type { AutomationPlan, ExtractionCandidate, ParameterCandidate } from "../automation/types";

export type PromptFunction = (question: string) => Promise<string>;

function normalizeYesNo(answer: string): boolean {
  return ["s", "sim", "y", "yes", "1", "true"].includes(answer.trim().toLowerCase());
}

async function configureParameter(prompt: PromptFunction, candidate: ParameterCandidate, index: number): Promise<ParameterCandidate> {
  const useCandidate = await prompt(`Parâmetro ${index + 1} [${candidate.path}] => ${candidate.sampleValue}. Transformar em variável? (s/N): `);
  if (!normalizeYesNo(useCandidate)) {
    return { ...candidate, enabled: false };
  }

  const variableName = (await prompt(`Nome da variável para ${candidate.path} [${candidate.suggestedName}]: `)).trim();
  return {
    ...candidate,
    enabled: true,
    suggestedName: variableName || candidate.suggestedName
  };
}

async function configureExtraction(prompt: PromptFunction, candidate: ExtractionCandidate, index: number): Promise<ExtractionCandidate> {
  const useCandidate = await prompt(`Extração ${index + 1} [${candidate.label}] => ${candidate.sampleValue}. Incluir no retorno? (s/N): `);
  if (!normalizeYesNo(useCandidate)) {
    return { ...candidate, enabled: false };
  }

  const resultKey = (await prompt(`Nome do campo de retorno para ${candidate.label} [${candidate.key}]: `)).trim();
  return {
    ...candidate,
    enabled: true,
    key: resultKey || candidate.key
  };
}

export async function reviewAutomationPlan(prompt: PromptFunction, plan: AutomationPlan): Promise<AutomationPlan> {
  const functionName = (await prompt(`Nome da função exportada [${plan.functionName}]: `)).trim() || plan.functionName;
  const reviewedParameters: ParameterCandidate[] = [];
  for (const [index, candidate] of plan.parameterCandidates.entries()) {
    reviewedParameters.push(await configureParameter(prompt, candidate, index));
  }

  const reviewedExtractions: ExtractionCandidate[] = [];
  for (const [index, candidate] of plan.extractionCandidates.entries()) {
    reviewedExtractions.push(await configureExtraction(prompt, candidate, index));
  }

  return {
    ...plan,
    functionName,
    parameterCandidates: reviewedParameters,
    extractionCandidates: reviewedExtractions
  };
}
