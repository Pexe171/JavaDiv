"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

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
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

          <p className="text-sm text-slate-500">
            Status da campanha: <strong>{status?.campaignStatus ?? campaign?.status ?? "-"}</strong>
          </p>
        </div>
      </section>

      {feedback ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">{feedback}</p> : null}
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</p> : null}

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
