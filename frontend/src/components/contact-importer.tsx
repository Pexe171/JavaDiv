"use client";

import { FormEvent, useMemo, useState } from "react";

type CampaignResponse = {
  id: number;
  titulo: string;
  assunto: string;
  conteudoHtml: string;
  status: string;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<CampaignResponse | null>(null);

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

      setFeedback(`Campanha #${createdCampaign.id} criada e disparada com sucesso.`);
      setLiveLink("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erro inesperado ao enviar campanha.");
    } finally {
      setIsSubmitting(false);
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
          <p className="mt-4 text-sm text-slate-500">
            Última campanha enviada: #{campaign.id} ({campaign.status}).
          </p>
        ) : null}
      </section>
    </main>
  );
}
