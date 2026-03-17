import type { AppConfig } from "../types/config";
import type { RequestRecord, RelevanceScore } from "../types/network";

export interface ClassificationResult {
  label: RelevanceScore;
  score: number;
  relevant: boolean;
  reasons: string[];
  observations: string[];
}

const mutableMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export class RequestClassifier {
  public constructor(private readonly config: AppConfig) {}

  public classify(record: RequestRecord, recentRecords: RequestRecord[]): ClassificationResult {
    let score = 0;
    const reasons: string[] = [];
    const observations: string[] = [];
    const searchableContent = [record.request.url, record.request.pathname, record.request.bodyPreview, record.response?.bodyPreview ?? ""]
      .join(" ")
      .toLowerCase();

    if (mutableMethods.has(record.request.method)) {
      score += 40;
      reasons.push("Método mutável aumenta prioridade.");
    }

    if (record.request.method === "GET") {
      score += 10;
      reasons.push("GET relevante para bootstrap/configuração.");
    }

    if (record.request.bodyPreview.length >= 120) {
      score += 10;
      reasons.push("Payload estruturado com tamanho relevante.");
    }

    if ([200, 201, 202].includes(record.response?.status ?? 0)) {
      score += 10;
      reasons.push("Resposta de sucesso alinhada a fluxo funcional.");
    }

    if ((record.response?.contentType ?? "").toLowerCase().includes("application/json")) {
      score += 10;
      reasons.push("Resposta JSON detectada.");
    }

    const matchedKeywords = this.config.relevanceKeywords.filter((keyword) => searchableContent.includes(keyword.toLowerCase()));
    if (matchedKeywords.length > 0) {
      const keywordBoost = Math.min(30, matchedKeywords.length * 10);
      score += keywordBoost;
      reasons.push(`Palavras-chave relevantes: ${matchedKeywords.join(", ")}.`);
    }

    const burstMatch = recentRecords.some((recent) => {
      const delta = Math.abs(Date.parse(record.request.timestamp) - Date.parse(recent.request.timestamp));
      return delta <= 4000;
    });
    if (burstMatch) {
      score += 10;
      reasons.push("Chamada ocorreu em sequência curta com outras requisições relevantes.");
    }

    if (record.response?.status !== undefined && record.response.status >= 400) {
      score += 10;
      observations.push(`Falha HTTP ${record.response.status} detectada.`);
    }

    if (record.response?.error) {
      observations.push(`Erro de resposta: ${record.response.error}`);
    }

    if (record.request.bodyTruncated || record.response?.bodyTruncated) {
      observations.push("Payload truncado para persistência segura.");
    }

    const relevant = mutableMethods.has(record.request.method) || matchedKeywords.length > 0 || score >= this.config.mediumThreshold;
    const label: RelevanceScore = score >= this.config.highThreshold ? "HIGH" : score >= this.config.mediumThreshold ? "MEDIUM" : "LOW";

    return {
      label,
      score,
      relevant,
      reasons,
      observations
    };
  }
}
