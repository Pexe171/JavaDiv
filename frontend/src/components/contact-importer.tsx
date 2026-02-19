"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type CampaignResponse = {
  id: number;
  titulo: string;
  assunto: string;
  conteudoHtml: string;
  status: string;
};

type CampaignStatusResponse = {
  campaignId: number;
  campaignStatus: string;
  pending: number;
  sent: number;
  failed: number;
  enviosComSucesso: Array<{
    email: string;
    sentAt: string | null;
  }>;
  erros: Array<{
    email: string;
    errorMessage: string;
    sentAt: string | null;
  }>;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

function normalizarUrl(urlInformada: string): string {
  const texto = urlInformada.trim();
  if (!texto) {
    throw new Error("Informe o link da live para continuar.");
  }

  const urlComProtocolo = /^https?:\/\//i.test(texto) ? texto : `https://${texto}`;

  try {
    return new URL(urlComProtocolo).toString();
  } catch {
    throw new Error("O link informado é inválido. Confira e tente novamente.");
  }
}

function montarEmailHtml(linkLive: string): string {
  return `
    <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:20px;padding:28px;border:1px solid #e2e8f0;">
        <p style="margin:0;font-size:14px;color:#6366f1;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Convite especial</p>
        <h1 style="margin:12px 0 8px 0;font-size:28px;line-height:1.2;color:#0f172a;">Tem live nova no TikTok!</h1>
        <p style="margin:0 0 24px 0;font-size:16px;color:#334155;line-height:1.6;">
          Clique no botão abaixo para entrar na live agora e acompanhar tudo em tempo real.
        </p>
        <a href="${linkLive}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:700;">
          Clique aqui para assistir
        </a>
        <p style="margin:24px 0 0 0;font-size:12px;color:#64748b;">
          Se o botão não abrir, copie e cole este link no navegador: ${linkLive}
        </p>
      </div>
    </div>
  `;
}

export function ContactImporter() {
  const [liveLink, setLiveLink] = useState("");
  const [contactsRawInput, setContactsRawInput] = useState("");
  const [isImportingContacts, setIsImportingContacts] = useState(false);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [totalEmailsImportados, setTotalEmailsImportados] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<CampaignResponse | null>(null);
  const [campaignStatus, setCampaignStatus] = useState<CampaignStatusResponse | null>(null);
  const [isPollingStatus, setIsPollingStatus] = useState(false);

  useEffect(() => {
    if (!campaign?.id) {
      return;
    }

    let foiCancelado = false;
    let intervalo: ReturnType<typeof setInterval> | null = null;

    const carregarStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/api/campaigns/${campaign.id}/status`);
        if (!response.ok) {
          throw new Error("Não foi possível consultar o status da campanha.");
        }

        const status = (await response.json()) as CampaignStatusResponse;
        if (foiCancelado) {
          return;
        }

        setCampaignStatus(status);

        if (status.campaignStatus === "FINISHED") {
          setIsPollingStatus(false);
          if (intervalo) {
            clearInterval(intervalo);
          }
        }
      } catch (statusError) {
        if (foiCancelado) {
          return;
        }

        setError(statusError instanceof Error ? statusError.message : "Falha ao atualizar status da campanha.");
        setIsPollingStatus(false);
        if (intervalo) {
          clearInterval(intervalo);
        }
      }
    };

    setIsPollingStatus(true);
    setCampaignStatus(null);
    void carregarStatus();
    intervalo = setInterval(() => {
      void carregarStatus();
    }, 2000);

    return () => {
      foiCancelado = true;
      if (intervalo) {
        clearInterval(intervalo);
      }
    };
  }, [campaign?.id]);

  const emailsPreparadosParaImportacao = useMemo(() => {
    const linhas = contactsRawInput.split(/\r?\n/);
    const unicos = new Set<string>();

    for (const linha of linhas) {
      const emailAntesDeDoisPontos = linha.split(":")[0]?.trim().toLowerCase();
      if (!emailAntesDeDoisPontos) {
        continue;
      }

      unicos.add(emailAntesDeDoisPontos);
    }

    return Array.from(unicos);
  }, [contactsRawInput]);

  const previewLink = useMemo(() => {
    if (!liveLink.trim()) {
      return "https://tiktok.com/@seuusuario/live";
    }

    try {
      return normalizarUrl(liveLink);
    } catch {
      return liveLink;
    }
  }, [liveLink]);

  const criarEEnviarCampanha = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);
    setError(null);

    try {
      const linkNormalizado = normalizarUrl(liveLink);
      const titulo = `Live TikTok ${new Date().toLocaleDateString("pt-BR")}`;
      const assunto = "🔴 Estamos AO VIVO no TikTok - clique para entrar";
      const conteudoHtml = montarEmailHtml(linkNormalizado);

      const createResponse = await fetch(`${API_URL}/api/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, assunto, conteudoHtml }),
      });

      if (!createResponse.ok) {
        const message = await createResponse.text();
        throw new Error(message || "Falha ao criar campanha.");
      }

      const createdCampaign = (await createResponse.json()) as CampaignResponse;
      setCampaign(createdCampaign);

      const sendNowResponse = await fetch(`${API_URL}/api/campaigns/${createdCampaign.id}/send-now`, {
        method: "POST",
      });

      if (!sendNowResponse.ok) {
        const message = await sendNowResponse.text();
        throw new Error(message || "Campanha criada, mas houve falha no disparo imediato.");
      }

      setFeedback(`Campanha #${createdCampaign.id} criada. Disparo iniciado e status sendo acompanhado em tempo real.`);
      setLiveLink("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erro inesperado ao enviar campanha.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const importarContatos = async () => {
    setImportError(null);
    setImportFeedback(null);

    if (emailsPreparadosParaImportacao.length === 0) {
      setImportError("Cole pelo menos um e-mail para importar.");
      return;
    }

    setIsImportingContacts(true);

    try {
      const response = await fetch(`${API_URL}/api/contacts/import-lines`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: emailsPreparadosParaImportacao.join("\n"),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Falha ao importar contatos.");
      }

      setImportFeedback(`Importação concluída com ${emailsPreparadosParaImportacao.length} e-mail(s) processado(s).`);
      setTotalEmailsImportados(emailsPreparadosParaImportacao.length);
      setContactsRawInput("");
    } catch (requestError) {
      setImportError(requestError instanceof Error ? requestError.message : "Erro inesperado ao importar contatos.");
    } finally {
      setIsImportingContacts(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-10">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-indigo-100/50">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-600">JavaDiv • Disparo rápido</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900 md:text-4xl">E-mail pronto para live no TikTok</h1>
        <p className="mt-3 text-slate-600">
          Informe somente o link da live. O sistema gera um e-mail bonito com botão <strong>&ldquo;Clique aqui para assistir&rdquo;</strong> e dispara na hora.
        </p>

        <article className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-base font-bold text-slate-900">Importar base de e-mails</h2>
          <p className="mt-2 text-sm text-slate-600">
            Cole 1 e-mail por linha. Se vier no formato <code>email:qualquer-coisa</code>, só o trecho antes de <code>:</code> será considerado.
          </p>

          <textarea
            value={contactsRawInput}
            onChange={(event) => setContactsRawInput(event.target.value)}
            placeholder={"ana@email.com\nbruno@email.com:vip\ncarla@email.com:dados-extra"}
            rows={6}
            className="mt-4 w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none ring-indigo-200 transition focus:ring"
          />

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm font-semibold text-slate-700">Total de e-mails encontrados: {emailsPreparadosParaImportacao.length}</p>
            <button
              type="button"
              onClick={importarContatos}
              disabled={isImportingContacts}
              className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isImportingContacts ? "Importando..." : "Importar e-mails"}
            </button>
          </div>

          {importFeedback ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">{importFeedback}</p> : null}
          {importError ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{importError}</p> : null}
          {totalEmailsImportados !== null ? <p className="mt-3 text-xs text-slate-500">Última importação: {totalEmailsImportados} e-mail(s) processado(s).</p> : null}
        </article>

        <form onSubmit={criarEEnviarCampanha} className="mt-8 space-y-4">
          <label className="block text-sm font-semibold text-slate-700" htmlFor="live-link">
            Link da live
          </label>
          <input
            id="live-link"
            value={liveLink}
            onChange={(event) => setLiveLink(event.target.value)}
            placeholder="https://www.tiktok.com/@seuusuario/live"
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none ring-indigo-200 transition focus:ring"
            required
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-indigo-600 px-6 py-3 text-base font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Enviando campanha..." : "Clique aqui e enviar e-mail"}
          </button>
        </form>

        <article className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-5">
          <p className="text-sm font-semibold text-indigo-900">Prévia do botão no e-mail</p>
          <a
            href={previewLink}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block rounded-full bg-indigo-600 px-5 py-2 text-sm font-bold text-white"
          >
            Clique aqui para assistir
          </a>
        </article>

        {feedback ? <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">{feedback}</p> : null}
        {error ? <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</p> : null}

        {campaign ? (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-900">Acompanhamento da campanha #{campaign.id}</p>
            <p className="mt-2 text-sm text-slate-600">
              Status atual: <strong>{campaignStatus?.campaignStatus ?? campaign.status}</strong>
              {isPollingStatus ? " (atualizando automaticamente)" : ""}
            </p>

            {campaignStatus ? (
              <>
                {campaignStatus.campaignStatus === "FINISHED" && campaignStatus.sent === 0 && campaignStatus.failed === 0 ? (
                  <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Campanha finalizada sem envios. Isso normalmente indica que não há contatos elegíveis (consentimento ativo, inscrito em lives e sem descadastro).
                  </p>
                ) : null}

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs uppercase text-slate-500">Enviados com sucesso</p>
                  <p className="text-xl font-black text-emerald-600">{campaignStatus.sent}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs uppercase text-slate-500">Com falha</p>
                  <p className="text-xl font-black text-red-600">{campaignStatus.failed}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs uppercase text-slate-500">Pendentes</p>
                  <p className="text-xl font-black text-amber-600">{campaignStatus.pending}</p>
                </div>
              </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Carregando status da campanha...</p>
            )}

            {campaignStatus?.enviosComSucesso?.length ? (
              <div className="mt-5">
                <p className="text-sm font-semibold text-emerald-700">Últimos e-mails enviados com sucesso</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {campaignStatus.enviosComSucesso.map((registro) => (
                    <li key={`${registro.email}-${registro.sentAt}`} className="rounded-lg bg-emerald-50 px-3 py-2">
                      {registro.email}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {campaignStatus?.erros?.length ? (
              <div className="mt-5">
                <p className="text-sm font-semibold text-red-700">Erros de envio (log do back-end)</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {campaignStatus.erros.map((erro) => (
                    <li key={`${erro.email}-${erro.sentAt}`} className="rounded-lg bg-red-50 px-3 py-2">
                      <strong>{erro.email}</strong>: {erro.errorMessage || "Erro sem detalhe"}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}
      </section>
    </main>
  );
}
