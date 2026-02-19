"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type CampaignResponse = {
  id: number;
  titulo: string;
  assunto: string;
  conteudoHtml: string;
  status: string;
  scheduledAt: string | null;
  createdAt: string;
};

type CampaignErrorLogResponse = {
  email: string;
  errorMessage: string;
  sentAt: string | null;
};

type CampaignStatusResponse = {
  campaignId: number;
  campaignStatus: string;
  pending: number;
  sent: number;
  failed: number;
  erros: CampaignErrorLogResponse[];
};

type MailBatchConfigResponse = {
  mailBatchSize: number;
  mailBatchIntervalSeconds: number;
};

type ContactResponse = {
  id: number;
  nome: string;
  email: string;
  consentimento: boolean;
  inscritoLives: boolean;
  unsubscribedAt: string | null;
  createdAt: string;
};

type ImportContactsResponse = {
  totalLinhas: number;
  importados: number;
  ignoradosInvalidos: number;
  ignoradosDuplicados: number;
};

type CampaignLifecycleStep = {
  title: string;
  description: string;
  done: boolean;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const POLLING_INTERVAL = 4000;

export function ContactImporter() {
  const editorRef = useRef<HTMLDivElement>(null);

  const [titulo, setTitulo] = useState("");
  const [assunto, setAssunto] = useState("");
  const [conteudoHtml, setConteudoHtml] = useState("<p>Olá, pessoal!</p>");
  const [scheduledAt, setScheduledAt] = useState("");
  const [mailBatchSize, setMailBatchSize] = useState<number>(0);
  const [mailBatchIntervalSeconds, setMailBatchIntervalSeconds] = useState<number>(0);

  const [campaign, setCampaign] = useState<CampaignResponse | null>(null);
  const [status, setStatus] = useState<CampaignStatusResponse | null>(null);
  const [contacts, setContacts] = useState<ContactResponse[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendNowModalOpen, setIsSendNowModalOpen] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isImportingContacts, setIsImportingContacts] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportContactsResponse | null>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== conteudoHtml) {
      editorRef.current.innerHTML = conteudoHtml;
    }
  }, [conteudoHtml]);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch(`${API_URL}/api/campaigns/config`);
        if (!response.ok) {
          throw new Error("Não foi possível carregar a configuração de lotes.");
        }

        const payload = (await response.json()) as MailBatchConfigResponse;
        setMailBatchSize(payload.mailBatchSize);
        setMailBatchIntervalSeconds(payload.mailBatchIntervalSeconds);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Erro inesperado ao carregar configurações.",
        );
      }
    };

    loadConfig();
  }, []);

  const loadContacts = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/contacts`);
      if (!response.ok) {
        throw new Error("Não foi possível carregar os contatos.");
      }

      const payload = (await response.json()) as ContactResponse[];
      setContacts(payload);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Erro inesperado ao carregar contatos.",
      );
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    if (!campaign?.id) {
      return;
    }

    const interval = setInterval(() => {
      fetchCampaignStatus(campaign.id);
    }, POLLING_INTERVAL);

    return () => clearInterval(interval);
  }, [campaign?.id]);

  const totais = useMemo(() => {
    const pending = status?.pending ?? 0;
    const sent = status?.sent ?? 0;
    const failed = status?.failed ?? 0;
    const total = Math.max(pending + sent + failed, 1);

    return {
      pending,
      sent,
      failed,
      sentPercent: (sent / total) * 100,
      failedPercent: (failed / total) * 100,
      pendingPercent: (pending / total) * 100,
    };
  }, [status]);

  const fetchCampaignStatus = async (campaignId: number) => {
    try {
      const response = await fetch(`${API_URL}/api/campaigns/${campaignId}/status`);
      if (!response.ok) {
        throw new Error("Falha ao obter status da campanha.");
      }

      const payload = (await response.json()) as CampaignStatusResponse;
      setStatus(payload);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Erro inesperado ao consultar status.",
      );
    }
  };

  const executeCommand = (command: string) => {
    document.execCommand(command, false);
    setConteudoHtml(editorRef.current?.innerHTML ?? "");
  };

  const dispararCampanhaAgora = async () => {
    if (!campaign?.id) {
      setError("Crie uma campanha antes de disparar envio imediato.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`${API_URL}/api/campaigns/${campaign.id}/send-now`, {
        method: "POST",
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Falha ao disparar campanha imediatamente.");
      }

      setFeedback(`Disparo imediato da campanha #${campaign.id} iniciado com sucesso.`);
      setIsSendNowModalOpen(false);
      await fetchCampaignStatus(campaign.id);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Erro inesperado ao disparar campanha.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const lifecycleSteps = useMemo<CampaignLifecycleStep[]>(() => {
    const normalizedStatus = status?.campaignStatus ?? campaign?.status ?? "DRAFT";
    const totalProcessed = (status?.sent ?? 0) + (status?.failed ?? 0);
    const hasRecipients = (status?.pending ?? 0) + totalProcessed > 0;

    return [
      {
        title: "1. Campanha criada",
        description: "Conteúdo preparado e salvo para iniciar a jornada.",
        done: Boolean(campaign?.id),
      },
      {
        title: "2. Programação definida",
        description: "Campanha agendada em data futura ou marcada para envio manual.",
        done: normalizedStatus !== "DRAFT",
      },
      {
        title: "3. Disparo em execução",
        description: "Lotes sendo processados e tentativas registradas por destinatário.",
        done: normalizedStatus === "SENDING" || normalizedStatus === "SENT" || hasRecipients,
      },
      {
        title: "4. Ciclo finalizado",
        description: "Processamento concluído com totais de envio e falha consolidados.",
        done: normalizedStatus === "SENT" && (status?.pending ?? 0) === 0,
      },
    ];
  }, [campaign?.id, campaign?.status, status]);

  const contatosAtivos = contacts.filter((contact) => !contact.unsubscribedAt).length;
  const contatosDescadastrados = contacts.length - contatosAtivos;

  const criarCampanha = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await fetch(`${API_URL}/api/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, assunto, conteudoHtml }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Falha ao criar campanha.");
      }

      const payload = (await response.json()) as CampaignResponse;
      setCampaign(payload);
      setFeedback(`Campanha #${payload.id} criada com sucesso.`);
      await fetchCampaignStatus(payload.id);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Erro inesperado ao criar campanha.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const importarContatosPorLinhas = async (linhasEmails: string) => {
    setIsImportingContacts(true);
    setError(null);
    setFeedback(null);
    setImportSummary(null);

    try {
      const response = await fetch(`${API_URL}/api/contacts/import-lines`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: linhasEmails,
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Falha ao importar arquivo de e-mails.");
      }

      const payload = (await response.json()) as ImportContactsResponse;
      setImportSummary(payload);
      setFeedback("Importação concluída com sucesso.");
      await loadContacts();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Erro inesperado ao importar contatos.",
      );
    } finally {
      setIsImportingContacts(false);
    }
  };

  const processarArquivo = (file: File) => {
    if (file.type !== "text/plain" && !file.name.endsWith(".txt")) {
      setError("Selecione um arquivo .txt válido para importação.");
      return;
    }

    const fileReader = new FileReader();
    fileReader.onload = async (event) => {
      const rawText = event.target?.result;
      if (typeof rawText !== "string") {
        setError("Não foi possível ler o conteúdo do arquivo selecionado.");
        return;
      }

      const normalizedLines = rawText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n");

      if (!normalizedLines) {
        setError("O arquivo está vazio. Informe pelo menos um e-mail por linha.");
        return;
      }

      await importarContatosPorLinhas(normalizedLines);
    };

    fileReader.onerror = () => {
      setError("Erro ao processar o arquivo. Tente novamente.");
    };

    fileReader.readAsText(file, "utf-8");
  };

  const agendarCampanha = async () => {
    if (!campaign?.id || !scheduledAt) {
      setError("Crie a campanha e informe data/hora para agendar.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setFeedback(null);

    try {
      const scheduledAtIso = new Date(scheduledAt).toISOString();
      const response = await fetch(`${API_URL}/api/campaigns/${campaign.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: scheduledAtIso }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Falha ao agendar campanha.");
      }

      const payload = (await response.json()) as CampaignResponse;
      setCampaign(payload);
      setFeedback(`Campanha #${payload.id} agendada para ${new Date(scheduledAtIso).toLocaleString("pt-BR")}.`);
      await fetchCampaignStatus(payload.id);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Erro inesperado ao agendar campanha.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
          Gestão de campanhas
        </p>
        <h1 className="text-3xl font-bold text-slate-900">Criação, agendamento e monitoramento</h1>
        <p className="text-slate-600">
          Configure o conteúdo, agende envio e acompanhe o progresso em tempo real dos disparos.
        </p>
      </header>

      <section className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-indigo-900">Ciclo de vida da campanha</h2>
        <p className="mt-1 text-sm text-indigo-800">
          Acompanhe em qual etapa sua campanha está para decidir entre agendar ou disparar imediatamente.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {lifecycleSteps.map((step) => (
            <article
              key={step.title}
              className={`rounded-xl border p-4 ${step.done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}
            >
              <p className="text-sm font-semibold text-slate-900">{step.title}</p>
              <p className="mt-1 text-sm text-slate-600">{step.description}</p>
              <p className={`mt-2 text-xs font-semibold uppercase ${step.done ? "text-emerald-700" : "text-slate-500"}`}>
                {step.done ? "Concluída" : "Pendente"}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={criarCampanha} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Editor de conteúdo</h2>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Título</label>
            <input
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-indigo-200 focus:ring"
              placeholder="Nome interno da campanha"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Assunto</label>
            <input
              value={assunto}
              onChange={(event) => setAssunto(event.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-indigo-200 focus:ring"
              placeholder="Assunto do e-mail"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Conteúdo HTML (Rich Text)</label>
            <div className="mb-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => executeCommand("bold")} className="rounded-lg border px-3 py-1 text-sm">Negrito</button>
              <button type="button" onClick={() => executeCommand("italic")} className="rounded-lg border px-3 py-1 text-sm">Itálico</button>
              <button type="button" onClick={() => executeCommand("insertUnorderedList")} className="rounded-lg border px-3 py-1 text-sm">Lista</button>
            </div>
            <div
              ref={editorRef}
              contentEditable
              onInput={() => setConteudoHtml(editorRef.current?.innerHTML ?? "")}
              className="min-h-48 rounded-xl border border-slate-300 p-3 focus:outline-none focus:ring"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {isSubmitting ? "Salvando..." : "Criar campanha"}
          </button>
        </form>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Agendamento e parâmetros de lote</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">MAIL_BATCH_SIZE</label>
              <input
                type="number"
                value={mailBatchSize}
                readOnly
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">MAIL_BATCH_INTERVAL_SECONDS</label>
              <input
                type="number"
                value={mailBatchIntervalSeconds}
                readOnly
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Data e hora do envio</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-indigo-200 focus:ring"
            />
          </div>

          <button
            type="button"
            onClick={agendarCampanha}
            disabled={!campaign || isSubmitting}
            className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Processando..." : "Agendar campanha"}
          </button>

          <button
            type="button"
            onClick={() => setIsSendNowModalOpen(true)}
            disabled={!campaign || isSubmitting}
            className="w-full rounded-xl bg-amber-500 px-5 py-3 font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Processando..." : "Disparar agora"}
          </button>

          <p className="text-sm text-slate-500">
            Status da campanha: <strong>{status?.campaignStatus ?? campaign?.status ?? "-"}</strong>
          </p>
        </div>
      </section>

      {feedback ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">{feedback}</p> : null}
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</p> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Importação de contatos (.txt)</h2>
        <p className="mt-1 text-sm text-slate-600">
          Arraste e solte um arquivo com um e-mail por linha para enviar diretamente ao endpoint de importação.
        </p>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDraggingFile(true);
          }}
          onDragLeave={() => setIsDraggingFile(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDraggingFile(false);

            const file = event.dataTransfer.files[0];
            if (file) {
              processarArquivo(file);
            }
          }}
          className={`mt-4 rounded-2xl border-2 border-dashed p-8 text-center transition ${isDraggingFile ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-slate-50"}`}
        >
          <p className="text-base font-semibold text-slate-800">
            {isImportingContacts ? "Importando arquivo..." : "Arraste seu arquivo .txt aqui"}
          </p>
          <p className="mt-2 text-sm text-slate-600">ou selecione manualmente no botão abaixo.</p>

          <label className="mt-4 inline-flex cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            Selecionar arquivo
            <input
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  processarArquivo(file);
                }
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>

        {importSummary ? (
          <article className="mt-4 animate-pulse rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            <p className="text-sm font-semibold">Resumo da importação</p>
            <p className="mt-1 text-sm">
              {importSummary.totalLinhas} e-mails processados: {importSummary.importados} importados ✅, {" "}
              {importSummary.ignoradosInvalidos} inválidos ❌, {importSummary.ignoradosDuplicados} duplicados 🔁.
            </p>
          </article>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Painel de monitoramento e progresso</h2>

        <div className="mt-4 h-6 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="flex h-full w-full">
            <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${totais.sentPercent}%` }} />
            <div className="h-full bg-red-500 transition-all duration-700" style={{ width: `${totais.failedPercent}%` }} />
            <div className="h-full animate-pulse bg-slate-400 transition-all duration-700" style={{ width: `${totais.pendingPercent}%` }} />
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <StatusCard label="Enviados" value={totais.sent} className="text-emerald-600" />
          <StatusCard label="Falhas" value={totais.failed} className="text-red-600" />
          <StatusCard label="Pendentes" value={totais.pending} className="text-slate-600" />
        </div>

        <div className="mt-6">
          <h3 className="font-medium text-slate-800">Logs de retorno (falhas)</h3>
          <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-950 p-3 font-mono text-xs text-slate-100">
            {!status?.erros?.length ? (
              <p className="text-slate-400">Nenhum erro registrado até o momento.</p>
            ) : (
              status.erros.map((log, index) => (
                <p key={`${log.email}-${index}`} className="mb-2 border-b border-slate-800 pb-2">
                  [{log.sentAt ? new Date(log.sentAt).toLocaleString("pt-BR") : "sem data"}] {log.email} - {log.errorMessage}
                </p>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Higienização visual da base</h2>
        <p className="mt-1 text-sm text-slate-600">
          Contatos descadastrados ficam marcados para facilitar revisão e limpeza da sua operação.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <StatusCard label="Contatos ativos" value={contatosAtivos} className="text-emerald-600" />
          <StatusCard label="Descadastrados" value={contatosDescadastrados} className="text-amber-600" />
        </div>

        <div className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Nome</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">E-mail</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {!contacts.length ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                    Nenhum contato cadastrado até o momento.
                  </td>
                </tr>
              ) : (
                contacts.map((contact) => (
                  <tr key={contact.id} className={contact.unsubscribedAt ? "bg-amber-50/60" : ""}>
                    <td className="px-4 py-3 text-slate-700">{contact.nome}</td>
                    <td className="px-4 py-3 text-slate-700">{contact.email}</td>
                    <td className="px-4 py-3">
                      {contact.unsubscribedAt ? (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                          Descadastrado em {new Date(contact.unsubscribedAt).toLocaleDateString("pt-BR")}
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                          Ativo
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isSendNowModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Confirmar disparo imediato</h3>
            <p className="mt-2 text-sm text-slate-600">
              Esse processo inicia o envio da campanha agora e ignora o horário agendado. Deseja continuar?
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsSendNowModalOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={dispararCampanhaAgora}
                disabled={isSubmitting}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
              >
                {isSubmitting ? "Enviando..." : "Confirmar disparo"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

type StatusCardProps = {
  label: string;
  value: number;
  className: string;
};

function StatusCard({ label, value, className }: StatusCardProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`text-2xl font-bold ${className}`}>{value}</p>
    </article>
  );
}
