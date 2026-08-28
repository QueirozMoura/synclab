import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { reconstructHistoricalState, type HistoricalStateResult } from "../lib/documentHistory";
import { reconstructHistoricalDocument } from "../lib/documentHistoricalState";
import { useDocuments } from "../hooks/useDocuments";
import { useOperationManager } from "../hooks/useOperationManager";

export const ActivityDetailsPage: React.FC = () => {
  const { activityId } = useParams<{ activityId: string }>();
  const { activity, getDocument } = useDocuments();
  const { getOperationsForDocument } = useOperationManager();
  const event = activity.find((item) => item.id === activityId);
  const [historicalState, setHistoricalState] = useState<{
    operationId: string;
    result: HistoricalStateResult;
  } | null>(null);
  const operationId = event?.operationId;
  const isHistoryLoading = Boolean(operationId) && historicalState?.operationId !== operationId;

  useEffect(() => {
    let cancelled = false;
    if (!event || !operationId) {
      return () => { cancelled = true; };
    }

    const loadHistoricalState = async () => {
      const maxAttempts = 3;
      let result: HistoricalStateResult = { status: "insufficient_history" };
      for (let attempt = 0; attempt < maxAttempts && !cancelled; attempt += 1) {
        try {
          result = await reconstructHistoricalState(event.documentId ?? "", operationId);
        } catch {
          result = { status: "insufficient_history" };
        }
        if (result.status === "success" || attempt === maxAttempts - 1) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (!cancelled) setHistoricalState({ operationId, result });
    };

    void loadHistoricalState();
    return () => { cancelled = true; };
  }, [event, operationId]);

  const documentId = event?.documentId;
  const historicalVersion = React.useMemo(() => {
    if (!documentId || !operationId) return null;
    try {
      const operations = getOperationsForDocument(documentId);
      const operation = operations.find(({ id }) => id === operationId);
      return {
        operationId,
        state: operation
          ? reconstructHistoricalDocument(documentId, operations, { operationId })
          : null,
      };
    } catch {
      return { operationId, state: null };
    }
  }, [documentId, getOperationsForDocument, operationId]);

  if (
    !event ||
    (event.type !== "DOCUMENT_UPDATED" && event.type !== "DOCUMENT_CREATED")
  ) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-6 py-12 text-[var(--text-primary)]">
        <div className="mx-auto max-w-3xl">
          <Link to="/app" className="dashboard-text-button">
            ← Voltar para atividade
          </Link>
          <section className="mt-12 rounded-2xl border-[var(--border)] bg-[var(--surface)] p-8">
            <h1 className="text-2xl font-semibold">Atividade não encontrada</h1>
            <p className="mt-2 text-[var(--text-secondary)]">
              A atividade solicitada não está mais disponível.
            </p>
            <Link to="/app" className="dashboard-text-button mt-6 inline-block">
              Voltar para atividade
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const title =
    event.type === "DOCUMENT_CREATED"
      ? `Você criou ${event.documentTitle ?? "um documento"}`
      : `Você editou ${event.documentTitle ?? "um documento"}`;
  const date = new Date(event.timestamp).toLocaleString("pt-BR");
  const relatedOperationIds =
    event.operationIds ?? (event.operationId ? [event.operationId] : []);
  const historicalResult = historicalState?.result;
  const historicalVersionState = historicalVersion && historicalVersion.operationId === operationId
    ? historicalVersion.state
    : null;
  const currentDocument = documentId ? getDocument(documentId) : undefined;
  const titleChanged = Boolean(currentDocument && historicalVersionState && currentDocument.title !== historicalVersionState.title);
  const contentChanged = Boolean(currentDocument && historicalVersionState && currentDocument.content !== historicalVersionState.content);
  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-8 text-[var(--text-primary)]">
      <div className="mx-auto max-w-4xl">
        <Link to="/app" className="dashboard-text-button">
          ← Voltar para atividade
        </Link>
        <header className="mt-10">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--primary)]">
            Alteração
          </p>
          <h1 className="mt-3 text-3xl font-semibold">{title}</h1>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">{date}</p>
          {relatedOperationIds.length > 0 && (
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              Operação relacionada: {relatedOperationIds.length}
            </p>
          )}
        </header>
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Resumo</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border-[var(--border)] bg-[var(--surface)] p-6">
              <p className="text-3xl font-semibold">1</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                alteração
              </p>
            </div>
            <div className="rounded-2xl border-[var(--border)] bg-[var(--surface)] p-6">
              <p className="text-3xl font-semibold">1</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                documento
              </p>
            </div>
          </div>
        </section>
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Documento</h2>
          <div className="mt-4 rounded-2xl border-[var(--border)] bg-[var(--surface)] p-6 transition-colors hover:border-[var(--outline-variant)]">
            <p className="text-lg font-medium">
              {event.documentTitle ?? "Documento"}
            </p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Última alteração: {date}
            </p>
          </div>
        </section>
        {historicalVersionState && (
          <section className="mt-10" aria-live="polite">
            <h2 className="text-lg font-semibold">Versão deste momento</h2>
            <div className="mt-4 rounded-2xl border-[var(--border)] bg-[var(--surface)] p-6">
              <p className="text-sm text-[var(--text-secondary)]">
                Estado do documento reconstruído no momento desta atividade ({date}).
              </p>
              <p className="mt-4 text-lg font-medium">{historicalVersionState.title}</p>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl border-[var(--border)] bg-[var(--background)] p-4 text-sm text-[var(--text-secondary)]">
                {historicalVersionState.content}
              </pre>
              {historicalVersionState.deleted && (
                <p className="mt-3 text-sm text-[var(--text-secondary)]">Documento excluído neste momento.</p>
              )}
            </div>
            <div className="mt-4 rounded-2xl border-[var(--border)] bg-[var(--surface)] p-6">
              <p className="text-sm font-medium uppercase tracking-[0.12em] text-[var(--text-secondary)]">Versão atual</p>
              {currentDocument ? (
                <>
                  <p className="mt-3 text-lg font-medium">{currentDocument.title}</p>
                  <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl border-[var(--border)] bg-[var(--background)] p-4 text-sm text-[var(--text-secondary)]">
                    {currentDocument.content}
                  </pre>
                  <div className="mt-4 space-y-2 text-sm text-[var(--text-secondary)]">
                    <p>{titleChanged ? "O título foi alterado posteriormente." : "Não houve alteração posterior no título."}</p>
                    <p>{contentChanged ? "O conteúdo foi alterado posteriormente." : "Não houve alteração posterior no conteúdo."}</p>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-[var(--text-secondary)]">A versão atual não está disponível.</p>
              )}
            </div>
          </section>
        )}
        {event.operationId && (
          <section className="mt-10" aria-live="polite">
            <h2 className="text-lg font-semibold">Histórico</h2>
            {isHistoryLoading && <p className="mt-4 text-sm text-[var(--text-secondary)]">Carregando histórico…</p>}
            {!isHistoryLoading && historicalResult?.status === "success" && (
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border-[var(--border)] bg-[var(--surface)] p-6">
                    <p className="text-sm font-medium uppercase tracking-[0.12em] text-[var(--text-secondary)]">Before</p>
                    {historicalResult.before ? (
                      <>
                        <p className="mt-3 text-xs font-medium uppercase tracking-[0.1em] text-[var(--text-secondary)]">Título</p>
                        <p className="mt-1 rounded-xl border-red-500/30 bg-red-500/10 p-3 text-lg font-medium text-[var(--text-primary)]">− {historicalResult.before.title}</p>
                        <p className="mt-3 text-xs font-medium uppercase tracking-[0.1em] text-[var(--text-secondary)]">Conteúdo</p>
                        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl border-red-500/30 bg-red-500/10 p-4 text-sm text-[var(--text-secondary)]">− {historicalResult.before.content}</pre>
                      </>
                    ) : (
                      <p className="mt-3 text-sm text-[var(--text-secondary)]">Documento inexistente antes da operação.</p>
                    )}
                  </div>
                  <div className="rounded-2xl border-[var(--border)] bg-[var(--surface)] p-6">
                    <p className="text-sm font-medium uppercase tracking-[0.12em] text-[var(--text-secondary)]">After</p>
                    {historicalResult.after ? (
                      <>
                        <p className="mt-3 text-xs font-medium uppercase tracking-[0.1em] text-[var(--text-secondary)]">Título</p>
                        <p className="mt-1 rounded-xl border-emerald-500/30 bg-emerald-500/10 p-3 text-lg font-medium text-[var(--text-primary)]">+ {historicalResult.after.title}</p>
                        <p className="mt-3 text-xs font-medium uppercase tracking-[0.1em] text-[var(--text-secondary)]">Conteúdo</p>
                        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-[var(--text-secondary)]">+ {historicalResult.after.content}</pre>
                      </>
                    ) : (
                      <p className="mt-3 text-sm text-[var(--text-secondary)]">Documento excluído após a operação.</p>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border-[var(--border)] bg-[var(--surface)] p-6">
                  {historicalResult.operation.type === "UPDATE_TITLE" && (
                    <p className="text-sm"><span className="font-medium">Título alterado:</span> {historicalResult.before?.title ?? "(inexistente)"} → {historicalResult.after?.title ?? "(inexistente)"}</p>
                  )}
                  {historicalResult.operation.type === "UPDATE_CONTENT" && (
                    <div className="text-sm">
                      <p className="font-medium">Conteúdo alterado</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="mb-1 text-xs font-medium uppercase tracking-[0.1em] text-red-400">− Removido</p>
                          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-xl border-red-500/30 bg-red-500/10 p-3 text-[var(--text-secondary)]">{historicalResult.before?.content ?? "(inexistente)"}</pre>
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-medium uppercase tracking-[0.1em] text-emerald-400">+ Adicionado</p>
                          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-xl border-emerald-500/30 bg-emerald-500/10 p-3 text-[var(--text-secondary)]">{historicalResult.after?.content ?? "(inexistente)"}</pre>
                        </div>
                      </div>
                    </div>
                  )}
                  {historicalResult.operation.type === "CREATE_DOCUMENT" && <p className="text-sm font-medium">Documento criado.</p>}
                  {historicalResult.operation.type === "DELETE_DOCUMENT" && <p className="text-sm font-medium">Documento excluído.</p>}
                </div>
              </div>
            )}
            {!isHistoryLoading && historicalState && historicalState.result.status !== "success" && (
              <p className="mt-4 text-sm text-[var(--text-secondary)]">Histórico não disponível para esta atividade.</p>
            )}
          </section>
        )}
      </div>
    </main>
  );
};
