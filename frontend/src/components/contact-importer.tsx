"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from "react";

type ImportContactsResponse = {
  totalLinhas: number;
  importados: number;
  ignoradosInvalidos: number;
  ignoradosDuplicados: number;
  emailsImportados: string[];
  emailsInvalidos: string[];
  emailsDuplicados: string[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export function ContactImporter() {
  const [isDragging, setIsDragging] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportContactsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Aguardando ficheiro .txt para iniciar a importação.");


  useEffect(() => {
    if (!rawText.trim()) {
      setStatusMessage("Aguardando ficheiro .txt para iniciar a importação.");
      return;
    }

    const lines = rawText.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
    setStatusMessage(`Ficheiro pronto com ${lines} linha(s). Pode enviar para a API.`);
  }, [rawText]);

  useEffect(() => {
    if (result) {
      setStatusMessage("Importação concluída com sucesso. Confira o resumo abaixo.");
    }
  }, [result]);

  const totalProcessado = useMemo(() => {
    if (!result) {
      return 0;
    }

    return result.importados + result.ignoradosInvalidos + result.ignoradosDuplicados;
  }, [result]);

  const parseFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".txt")) {
      setError("Use apenas ficheiros .txt com um e-mail por linha.");
      return;
    }

    const text = await file.text();
    setRawText(text);
    setFileName(file.name);
    setError(null);
    setResult(null);
  };

  const handleDrop = async (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) {
      await parseFile(droppedFile);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      await parseFile(selectedFile);
    }
  };

  const submitImport = async () => {
    if (!rawText.trim()) {
      setError("Carregue um ficheiro válido antes de importar.");
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/contacts/import-lines`, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: rawText,
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Falha ao importar contatos.");
      }

      const payload = (await response.json()) as ImportContactsResponse;
      setResult(payload);
    } catch (requestError) {
      setResult(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Erro inesperado ao importar contatos.",
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
          Módulo de gestão de contatos
        </p>
        <h1 className="text-3xl font-bold text-slate-900">
          Importação de contactos por ficheiro TXT
        </h1>
        <p className="text-slate-600">
          Arraste um ficheiro com um e-mail por linha e envie para a API Java usando
          <code className="mx-1 rounded bg-slate-200 px-1 py-0.5 text-sm">text/plain</code>.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label
          onDrop={handleDrop}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          htmlFor="txt-upload"
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition ${
            isDragging
              ? "border-indigo-500 bg-indigo-50"
              : "border-slate-300 bg-slate-50 hover:border-indigo-400"
          }`}
        >
          <p className="text-lg font-medium text-slate-700">Arraste e solte o ficheiro aqui</p>
          <p className="mt-2 text-sm text-slate-500">ou clique para selecionar um .txt</p>
          {fileName ? (
            <p className="mt-4 rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700">
              Ficheiro selecionado: {fileName}
            </p>
          ) : null}
          <input
            id="txt-upload"
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>

        <button
          type="button"
          onClick={submitImport}
          disabled={isSending}
          className="mt-5 inline-flex items-center rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSending ? "Importando..." : "Enviar para /api/contacts/import-lines"}
        </button>

        <p className="mt-4 text-sm text-slate-600">{statusMessage}</p>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </section>

      {result ? (
        <section className="grid gap-4 md:grid-cols-4">
          <ResultCard title="Linhas recebidas" value={result.totalLinhas} color="slate" />
          <ResultCard title="Importados" value={result.importados} color="green" />
          <ResultCard title="Inválidos" value={result.ignoradosInvalidos} color="amber" />
          <ResultCard title="Duplicados" value={result.ignoradosDuplicados} color="rose" />

          <p className="md:col-span-4 text-sm text-slate-600">
            Total processado: <strong>{totalProcessado}</strong>
          </p>
        </section>
      ) : null}
    </main>
  );
}

type ResultCardProps = {
  title: string;
  value: number;
  color: "slate" | "green" | "amber" | "rose";
};

function ResultCard({ title, value, color }: ResultCardProps) {
  const palette = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    green: "border-green-200 bg-green-50 text-green-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  };

  return (
    <article className={`rounded-2xl border p-5 shadow-sm ${palette[color]}`}>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </article>
  );
}
