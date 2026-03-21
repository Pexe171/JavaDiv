import readline from "node:readline";

import { exportAxiosArtifacts } from "../exporters/axiosExporter";
import { exportCurlArtifacts } from "../exporters/curlExporter";
import { exportFetchArtifacts } from "../exporters/fetchExporter";
import { exportHttpxArtifacts } from "../exporters/httpxExporter";
import { buildAutomationPlan } from "../automation/automationBlueprint";
import { reviewAutomationPlan } from "./automationPrompts";
import type { AnalysisWorkspace } from "../cli/workspace";
import { persistSessionArtifacts, regroupRecords } from "../cli/workspace";
import type { AppConfig, ExportFormat } from "../types/config";
import type { FlowGroup } from "../types/flow";
import type { RequestRecord } from "../types/network";
import { Logger } from "../utils/logger";

type ActivePane = "flows" | "requests";
type FilterMode = "all" | "relevant" | "high";

interface ReviewTuiOptions {
  config: AppConfig;
  logger: Logger;
  workspace: AnalysisWorkspace;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function formatRequestStatus(record: RequestRecord): string {
  const status = record.response?.status ?? "ERR";
  const importantMarker = record.manuallyImportant ? "*" : " ";
  return `${importantMarker} [${record.relevance}] ${record.request.method} ${record.request.pathname} -> ${status}`;
}

function formatFlowLine(flow: FlowGroup): string {
  return `[${flow.relevance}] ${flow.name} (${flow.statistics.totalRequests} req)`;
}

export class ReviewTui {
  private activePane: ActivePane = "requests";
  private filterMode: FilterMode = "all";
  private selectedFlowIndex = 0;
  private selectedRequestIndex = 0;
  private message = "Use Tab para alternar entre flows e requests.";
  private dirty = false;
  private quitArmed = false;
  private busy = false;
  private finishRun?: (() => void) | undefined;
  private readonly onKeypressBound: (input: string, key: readline.Key) => void;

  public constructor(private readonly options: ReviewTuiOptions) {
    this.onKeypressBound = (input, key) => {
      void this.handleKeypress(input, key);
    };
  }

  public async run(): Promise<void> {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      throw new Error("A TUI requer um terminal TTY interativo.");
    }

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("keypress", this.onKeypressBound);

    try {
      this.render();
      await new Promise<void>((resolve) => {
        this.finishRun = resolve;
      });
    } finally {
      this.cleanup();
    }
  }

  private cleanup(): void {
    process.stdin.off("keypress", this.onKeypressBound);
    process.stdin.pause();
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    this.finishRun = undefined;
  }

  private async handleKeypress(input: string, key: readline.Key): Promise<void> {
    if (this.busy) {
      return;
    }

    this.busy = true;
    try {
      if (key.name === "tab" || input === "\t") {
        this.activePane = this.activePane === "flows" ? "requests" : "flows";
        this.message = `Painel ativo: ${this.activePane}.`;
        this.quitArmed = false;
      } else if (key.name === "up" || input === "k") {
        this.moveSelection(-1);
      } else if (key.name === "down" || input === "j") {
        this.moveSelection(1);
      } else if (input === "h") {
        this.activePane = "flows";
      } else if (input === "l") {
        this.activePane = "requests";
      } else if (input === "f") {
        this.cycleFilter();
      } else if (input === "i") {
        this.toggleImportant();
      } else if (input === "n") {
        await this.addNote();
      } else if (input === "r") {
        await this.renameSelectedFlow();
      } else if (input === "g") {
        this.regroup();
      } else if (input === "e") {
        await this.exportSelectedRequest();
      } else if (input === "a") {
        await this.generateSmartAutomation();
      } else if (input === "s" || input === "w") {
        await this.save();
      } else if (input === "q" || key.name === "escape") {
        if (this.dirty && !this.quitArmed) {
          this.quitArmed = true;
          this.message = "Há alterações não salvas. Pressione q novamente para sair sem salvar.";
        } else {
          this.message = "Encerrando TUI.";
          this.render();
          this.finishRun?.();
          this.cleanup();
          return;
        }
      }

      this.render();
    } finally {
      this.busy = false;
    }
  }

  private moveSelection(delta: number): void {
    this.quitArmed = false;
    if (this.activePane === "flows") {
      const maxIndex = Math.max(0, this.options.workspace.flows.length - 1);
      this.selectedFlowIndex = Math.max(0, Math.min(maxIndex, this.selectedFlowIndex + delta));
      this.selectedRequestIndex = 0;
      this.message = "Fluxo selecionado alterado.";
      return;
    }

    const requests = this.getVisibleRequests();
    const maxIndex = Math.max(0, requests.length - 1);
    this.selectedRequestIndex = Math.max(0, Math.min(maxIndex, this.selectedRequestIndex + delta));
    this.message = "Request selecionada alterada.";
  }

  private cycleFilter(): void {
    const order: FilterMode[] = ["all", "relevant", "high"];
    const currentIndex = order.indexOf(this.filterMode);
    this.filterMode = order[(currentIndex + 1) % order.length] ?? "all";
    this.selectedRequestIndex = 0;
    this.quitArmed = false;
    this.message = `Filtro ativo: ${this.filterMode}.`;
  }

  private toggleImportant(): void {
    const record = this.getSelectedRequest();
    if (!record) {
      this.message = "Nenhuma request selecionada para marcação.";
      return;
    }

    record.manuallyImportant = !record.manuallyImportant;
    if (record.manuallyImportant) {
      record.relevant = true;
      record.relevance = "HIGH";
      if (!record.scoreReasons.includes("Marcado manualmente como importante.")) {
        record.scoreReasons.push("Marcado manualmente como importante.");
      }
      this.message = `Request ${record.request.id} marcada como importante.`;
    } else {
      record.scoreReasons = record.scoreReasons.filter((reason) => reason !== "Marcado manualmente como importante.");
      this.message = `Marcação manual removida da request ${record.request.id}.`;
    }

    this.dirty = true;
    this.quitArmed = false;
  }

  private async addNote(): Promise<void> {
    const record = this.getSelectedRequest();
    if (!record) {
      this.message = "Nenhuma request selecionada para anotação.";
      return;
    }

    const answer = await this.prompt(`Adicionar nota para ${record.request.id}: `);
    if (!answer.trim()) {
      this.message = "Nota vazia ignorada.";
      return;
    }

    record.notes.push(answer.trim());
    this.dirty = true;
    this.quitArmed = false;
    this.message = `Nota adicionada à request ${record.request.id}.`;
  }

  private async renameSelectedFlow(): Promise<void> {
    const flow = this.getSelectedFlow();
    if (!flow) {
      this.message = "Nenhum flow selecionado para renomear.";
      return;
    }

    const answer = await this.prompt(`Novo nome para o flow ${flow.id}: `);
    const newName = answer.trim();
    if (!newName) {
      this.message = "Renomeação cancelada.";
      return;
    }

    flow.name = newName;
    for (const record of this.options.workspace.records) {
      if (record.flowId === flow.id) {
        record.flowName = newName;
      }
    }

    this.dirty = true;
    this.quitArmed = false;
    this.message = `Flow ${flow.id} renomeado para ${newName}.`;
  }

  private regroup(): void {
    const grouped = regroupRecords(this.options.workspace.records, this.options.config);
    this.options.workspace.records = grouped.records;
    this.options.workspace.flows = grouped.flows;
    this.selectedFlowIndex = Math.min(this.selectedFlowIndex, Math.max(0, grouped.flows.length - 1));
    this.selectedRequestIndex = 0;
    this.dirty = true;
    this.quitArmed = false;
    this.message = "Requests reagrupadas com as heurísticas refinadas do domínio.";
  }

  private async exportSelectedRequest(): Promise<void> {
    const record = this.getSelectedRequest();
    if (!record) {
      this.message = "Nenhuma request selecionada para exportação.";
      return;
    }

    const selectedFormat = (await this.prompt("Formato de exportação (axios/httpx/curl/fetch): ")).trim().toLowerCase() as ExportFormat;
    if (!["axios", "httpx", "curl", "fetch"].includes(selectedFormat)) {
      this.message = "Formato inválido. Use axios, httpx, curl ou fetch.";
      return;
    }

    if (selectedFormat === "axios") {
      await exportAxiosArtifacts([record], this.options.config);
    } else if (selectedFormat === "httpx") {
      await exportHttpxArtifacts([record], this.options.config);
    } else if (selectedFormat === "fetch") {
      await exportFetchArtifacts([record], this.options.config);
    } else {
      await exportCurlArtifacts([record], this.options.config);
    }

    this.message = `Exportação ${selectedFormat} gerada para ${record.request.id}.`;
  }

  private async generateSmartAutomation(): Promise<void> {
    const record = this.getSelectedRequest();
    if (!record) {
      this.message = "Nenhuma request selecionada para automação inteligente.";
      return;
    }

    if (!record.response) {
      this.message = "A automação inteligente exige uma response capturada.";
      return;
    }

    const basePlan = buildAutomationPlan(record);
    if (basePlan.parameterCandidates.length === 0 && basePlan.extractionCandidates.length === 0) {
      this.message = "Nenhum parâmetro ou resultado relevante foi inferido automaticamente.";
      return;
    }

    const reviewedPlan = await reviewAutomationPlan((question) => this.prompt(question), basePlan);
    const selectedFormat = (await this.prompt("Formato da automação inteligente (axios/httpx/curl/fetch): ")).trim().toLowerCase() as ExportFormat;
    if (!["axios", "httpx", "curl", "fetch"].includes(selectedFormat)) {
      this.message = "Formato inválido. Use axios, httpx, curl ou fetch.";
      return;
    }

    record.automationPlan = reviewedPlan;
    if (selectedFormat === "axios") {
      await exportAxiosArtifacts([record], this.options.config);
    } else if (selectedFormat === "httpx") {
      await exportHttpxArtifacts([record], this.options.config);
    } else if (selectedFormat === "fetch") {
      await exportFetchArtifacts([record], this.options.config);
    } else {
      await exportCurlArtifacts([record], this.options.config);
    }

    this.dirty = true;
    this.quitArmed = false;
    this.message = `Automação inteligente ${selectedFormat} gerada para ${record.request.id}.`;
  }

  private async save(): Promise<void> {
    const summary = await persistSessionArtifacts(
      this.options.workspace.records,
      this.options.workspace.flows,
      this.options.config,
      `interactive-tui:${this.options.workspace.inputDirectory}`
    );
    this.dirty = false;
    this.quitArmed = false;
    this.message = `Alterações salvas em ${summary.sessionId}.`;
  }

  private async prompt(question: string): Promise<string> {
    if (!process.stdin.isTTY) {
      return "";
    }

    process.stdin.off("keypress", this.onKeypressBound);
    process.stdin.setRawMode(false);

    return await new Promise<string>((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.question(question, (answer) => {
        rl.close();
        process.stdin.setRawMode(true);
        process.stdin.on("keypress", this.onKeypressBound);
        resolve(answer);
      });
    });
  }

  private getSelectedFlow(): FlowGroup | undefined {
    return this.options.workspace.flows[this.selectedFlowIndex];
  }

  private getVisibleRequests(): RequestRecord[] {
    const selectedFlow = this.getSelectedFlow();
    const baseRecords = selectedFlow
      ? this.options.workspace.records.filter((record) => record.flowId === selectedFlow.id)
      : this.options.workspace.records;

    if (this.filterMode === "relevant") {
      return baseRecords.filter((record) => record.relevant);
    }

    if (this.filterMode === "high") {
      return baseRecords.filter((record) => record.relevance === "HIGH");
    }

    return baseRecords;
  }

  private getSelectedRequest(): RequestRecord | undefined {
    const requests = this.getVisibleRequests();
    return requests[this.selectedRequestIndex];
  }

  private render(): void {
    const width = process.stdout.columns || 120;
    const flows = this.options.workspace.flows;
    const requests = this.getVisibleRequests();
    const selectedFlow = this.getSelectedFlow();
    const selectedRequest = this.getSelectedRequest();

    process.stdout.write("\x1bc");

    const headerLines = [
      "HTTP Traffic Observability - Interactive TUI",
      `Fluxos: ${flows.length} | Requests: ${this.options.workspace.records.length} | Filtro: ${this.filterMode} | Painel ativo: ${this.activePane} | Alterações pendentes: ${this.dirty ? "sim" : "não"}`,
      "Teclas: Tab alterna painel | j/k navega | i importante | n nota | r renomear flow | g reagrupar | e exportar | a automação | s salvar | q sair",
      `Mensagem: ${this.message}`
    ];

    for (const line of headerLines) {
      process.stdout.write(`${truncate(line, width)}\n`);
    }

    process.stdout.write(`${"-".repeat(Math.min(width, 100))}\n`);
    process.stdout.write(`${this.activePane === "flows" ? ">" : " "} Flows\n`);
    if (flows.length === 0) {
      process.stdout.write("  (nenhum flow carregado)\n");
    } else {
      for (const [index, flow] of flows.entries()) {
        const marker = index === this.selectedFlowIndex ? ">" : " ";
        process.stdout.write(`${marker} ${truncate(formatFlowLine(flow), width - 4)}\n`);
      }
    }

    process.stdout.write(`${"-".repeat(Math.min(width, 100))}\n`);
    process.stdout.write(`${this.activePane === "requests" ? ">" : " "} Requests do flow selecionado\n`);
    if (requests.length === 0) {
      process.stdout.write("  (nenhuma request visível com o filtro atual)\n");
    } else {
      for (const [index, record] of requests.entries()) {
        const marker = index === this.selectedRequestIndex ? ">" : " ";
        process.stdout.write(`${marker} ${truncate(formatRequestStatus(record), width - 4)}\n`);
      }
    }

    process.stdout.write(`${"-".repeat(Math.min(width, 100))}\n`);
    process.stdout.write("Detalhes\n");
    if (!selectedRequest) {
      process.stdout.write("  Nenhuma request selecionada.\n");
      return;
    }

    const detailLines = [
      `Flow atual: ${selectedFlow?.name ?? "n/a"} (${selectedFlow?.id ?? "sem-flow"})`,
      `Request: ${selectedRequest.request.id}`,
      `Stage: ${selectedRequest.domainStage ?? "unclassified"} | Definição: ${selectedRequest.domainDefinitionId ?? "n/a"} | Relevância: ${selectedRequest.relevance}`,
      `Status: ${selectedRequest.response?.status ?? "ERR"} | Duração: ${selectedRequest.response?.durationMs ?? 0}ms | Importante manual: ${selectedRequest.manuallyImportant ? "sim" : "não"}`,
      `Notas: ${selectedRequest.notes.length > 0 ? selectedRequest.notes.join(" | ") : "(sem notas)"}`,
      `Sinais de domínio: ${selectedRequest.domainSignals.length > 0 ? selectedRequest.domainSignals.join(", ") : "(nenhum)"}`,
      `Razões do score: ${selectedRequest.scoreReasons.length > 0 ? selectedRequest.scoreReasons.join(" | ") : "(nenhuma)"}`,
      `Observações: ${selectedRequest.autoObservations.length > 0 ? selectedRequest.autoObservations.join(" | ") : "(nenhuma)"}`,
      `Request preview: ${truncate(selectedRequest.request.bodyPreview || "(vazio)", width - 4)}`,
      `Response preview: ${truncate(selectedRequest.response?.bodyPreview || "(vazio)", width - 4)}`
    ];

    for (const line of detailLines) {
      process.stdout.write(`${truncate(line, width)}\n`);
    }
  }
}
