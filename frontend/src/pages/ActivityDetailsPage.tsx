import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { reconstructHistoricalState, type HistoricalStateResult } from "../lib/documentHistory";
import { reconstructHistoricalDocument } from "../lib/documentHistoricalState";
import { restoreHistoricalDocument, type HistoricalRestorationResult } from "../lib/historicalDocumentRestoration";
import { useDocuments } from "../hooks/useDocuments";
import { useOperationManager } from "../hooks/useOperationManager";
import type { Operation } from "../types/operation";

function friendlyOperationType(type: string): string {
  switch (type) {
    case "CREATE_DOCUMENT": return "Documento criado";
    case "UPDATE_TITLE": return "Você atualizou o título";
    case "UPDATE_CONTENT": return "Você atualizou o conteúdo";
    case "DELETE_DOCUMENT": return "Documento excluído";
    default: return "Alteração no documento";
  }
}

interface SyncOperationGroupProps {
  title: string;
  operations: Operation[];
  expandedOperationId: string | null;
  onSelect: (operationId: string) => void;
  getDocumentTitle: (documentId: unknown) => string | undefined;
  isDocumentAvailable: (documentId: unknown) => boolean;
}

function AlterationSummary({ operation }: { operation: Operation }) {
  const payload = (operation.payload ?? {}) as Record<string, unknown>;
  const payloadType = typeof payload.type === "string" ? payload.type : operation.type;
  const title = typeof payload.title === "string" ? payload.title : null;
  const content = typeof payload.content === "string" ? payload.content : null;
  const previousTitle = typeof payload.previousTitle === "string"
    ? payload.previousTitle
    : typeof payload.oldTitle === "string"
      ? payload.oldTitle
      : null;

  const knownTypes = new Set(["UPDATE_TITLE", "UPDATE_CONTENT", "CREATE_DOCUMENT", "DELETE_DOCUMENT"]);
  const operationKind = knownTypes.has(payloadType) ? payloadType : (payload.type === undefined ? operation.type : payloadType);

  switch (operationKind) {
    case "UPDATE_TITLE":
      return (
        <div data-testid={`operation-alteration-${operation.id}`}>
          <p className="mt-2 font-medium text-[var(--text-primary)]">Alteração</p>
          {previousTitle !== null && <p className="mt-1"><span className="font-medium text-[var(--text-primary)]">Título anterior:</span> {previousTitle}</p>}
          {previousTitle === null && <p className="mt-1">Título anterior não disponível nesta operação.</p>}
          <p className="mt-1"><span className="font-medium text-[var(--text-primary)]">Novo título:</span> {title ?? "não informado nesta operação"}</p>
        </div>
      );
    case "UPDATE_CONTENT":
      return (
        <div data-testid={`operation-alteration-${operation.id}`}>
          <p className="mt-2 font-medium text-[var(--text-primary)]">Alteração</p>
          <p className="mt-1 font-medium text-[var(--text-primary)]">Conteúdo atualizado</p>
          <p className="mt-1 whitespace-pre-wrap">{content ?? "Conteúdo não disponível nesta operação."}</p>
        </div>
      );
    case "CREATE_DOCUMENT":
      return (
        <div data-testid={`operation-alteration-${operation.id}`}>
          <p className="mt-2 font-medium text-[var(--text-primary)]">Alteração</p>
          <p className="mt-1 font-medium text-[var(--text-primary)]">Documento criado</p>
          <p className="mt-1"><span className="font-medium text-[var(--text-primary)]">Título inicial:</span> {title ?? "não informado nesta operação"}</p>
          <p className="mt-1 whitespace-pre-wrap"><span className="font-medium text-[var(--text-primary)]">Conteúdo inicial:</span> {content ?? "não informado nesta operação"}</p>
        </div>
      );
    case "DELETE_DOCUMENT":
      return (
        <div data-testid={`operation-alteration-${operation.id}`}>
          <p className="mt-2 font-medium text-[var(--text-primary)]">Alteração</p>
          <p className="mt-1 font-medium text-[var(--text-primary)]">Documento excluído</p>
          <p className="mt-1">O documento foi excluído. A operação marcou o documento como excluído.</p>
        </div>
      );
    default:
      return (
        <div data-testid={`operation-alteration-${operation.id}`}>
          <p className="mt-2 font-medium text-[var(--text-primary)]">Alteração</p>
          <p className="mt-1">Alteração registrada nesta operação. Os detalhes do payload não estão disponíveis.</p>
        </div>
      );
  }
}

const SyncOperationGroup: React.FC<SyncOperationGroupProps> = ({
  title,
  operations,
  expandedOperationId,
  onSelect,
  getDocumentTitle,
  isDocumentAvailable,
}) => {
  const groupedOperations = React.useMemo(() => {
    const groups = new Map<string, Operation[]>();
    operations.forEach((operation) => {
      const documentId = typeof operation.documentId === "string" && operation.documentId.trim()
        ? operation.documentId
        : "__unidentified__";
      const group = groups.get(documentId) ?? [];
      group.push(operation);
      groups.set(documentId, group);
    });
    return [...groups.entries()];
  }, [operations]);

  return (
  <div className="rounded-2xl border-[var(--border)] bg-[var(--surface)] p-6">
    <h3 className="text-sm font-medium uppercase tracking-[0.12em] text-[var(--text-secondary)]">{title}</h3>
    <div className="mt-4 space-y-5">
      {groupedOperations.map(([documentId, grouped]) => (
        <section key={documentId} className="rounded-xl border-[var(--border)] p-4" data-testid={`document-group-${documentId}`}>
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="font-medium">{documentId === "__unidentified__" ? "Documento não identificado" : getDocumentTitle(documentId) ?? "Documento indisponível"}</h4>
            <span className="text-xs text-[var(--text-secondary)]">{grouped.length} {grouped.length === 1 ? "alteração" : "alterações"}</span>
          </div>
          <div className="mt-3 space-y-3">
      {grouped.map((operation) => {
        const isExpanded = expandedOperationId === operation.id;
        return (
          <div key={operation.id} className="rounded-xl border-[var(--border)] p-4">
            <button
              type="button"
              className="w-full text-left"
              aria-expanded={isExpanded}
              aria-label={`Selecionar operação ${operation.id}`}
              onClick={() => onSelect(operation.id)}
            >
              <p className="font-medium">{friendlyOperationType(operation.type)}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">Documento: {operation.documentId}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">{new Date(operation.timestamp).toLocaleString("pt-BR")}</p>
            </button>
            {isExpanded && (
              <div className="mt-3 border-t border-[var(--border)] pt-3 text-sm text-[var(--text-secondary)]" data-testid={`operation-details-${operation.id}`}>
                <p><span className="font-medium text-[var(--text-primary)]">Documento:</span> {operation.documentId}</p>
                <p className="mt-1"><span className="font-medium text-[var(--text-primary)]">Tipo:</span> {operation.type}</p>
                <p className="mt-1"><span className="font-medium text-[var(--text-primary)]">Data/hora:</span> {new Date(operation.timestamp).toLocaleString("pt-BR")}</p>
                <p className="mt-1"><span className="font-medium text-[var(--text-primary)]">ID da operação:</span> {operation.id}</p>
                <p className="mt-1"><span className="font-medium text-[var(--text-primary)]">deviceId:</span> {operation.deviceId}</p>
                <AlterationSummary operation={operation} />
                {isDocumentAvailable(operation.documentId) && (
                  <Link
                    to={`/app/documents/${encodeURIComponent(operation.documentId)}`}
                    className="dashboard-text-button mt-4 inline-block text-sm"
                  >
                    Abrir documento →
                  </Link>
                )}
              </div>
            )}
          </div>
        );
      })}
          </div>
        </section>
      ))}
    </div>
  </div>
  );
};

export const ActivityDetailsPage: React.FC = () => {
  const { activityId } = useParams<{ activityId: string }>();
  const { activity, getDocument, updateDocument } = useDocuments();
  const { getOperations, getOperationsForDocument, createOperation } = useOperationManager();
  const [showSyncChanges, setShowSyncChanges] = useState(false);
  const [expandedOperationId, setExpandedOperationId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restorationMessage, setRestorationMessage] = useState<string | null>(null);
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

  const syncChanges = React.useMemo(() => {
    if (event?.type !== "SYNC_COMPLETED") return { sent: [], received: [], all: [] };
    const operationsById = new Map(getOperations().map((operation) => [operation.id, operation]));
    const unique = (ids: string[] | undefined) => [...new Set(ids ?? [])]
      .map((id) => operationsById.get(id))
      .filter((operation): operation is NonNullable<typeof operation> => Boolean(operation));
    const sent = unique(event.sentOperationIds);
    const received = unique(event.receivedOperationIds);
    const categorizedIds = new Set([...sent, ...received].map(({ id }) => id));
    const all = unique(event.operationIds).filter(({ id }) => !categorizedIds.has(id));
    return { sent, received, all };
  }, [event, getOperations]);
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
    (event.type !== "DOCUMENT_UPDATED" && event.type !== "DOCUMENT_CREATED" && event.type !== "SYNC_COMPLETED")
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
      : event.type === "SYNC_COMPLETED"
        ? "Sincronização concluída"
        : `Você editou ${event.documentTitle ?? "um documento"}`;
  const date = new Date(event.timestamp).toLocaleString("pt-BR");
  const relatedOperationIds =
    event.operationIds ?? (event.operationId ? [event.operationId] : []);
  const historicalResult = historicalState?.result;
  const historicalVersionState = historicalVersion && historicalVersion.operationId === operationId
    ? historicalVersion.state
    : null;
  const currentDocument = documentId ? getDocument(documentId) : undefined;
  const getDocumentTitle = (candidateDocumentId: unknown): string | undefined =>
    typeof candidateDocumentId === "string" && candidateDocumentId.trim().length > 0
      ? getDocument(candidateDocumentId)?.title
      : undefined;
  const isDocumentAvailable = (candidateDocumentId: unknown): candidateDocumentId is string =>
    typeof candidateDocumentId === "string" && candidateDocumentId.trim().length > 0 && Boolean(getDocument(candidateDocumentId));
  const canRestore = Boolean(operationId && historicalVersionState && !historicalVersionState.deleted && currentDocument && !isRestoring);
  const restoreVersion = () => {
    if (!documentId || !operationId || !historicalVersionState || historicalVersionState.deleted || !currentDocument || isRestoring) return;
    if (!window.confirm("O documento atual será substituído por esta versão. Isso criará uma nova alteração no histórico, sem apagar versões anteriores. Deseja continuar?")) return;

    setIsRestoring(true);
    setRestorationMessage(null);
    let result: HistoricalRestorationResult;
    try {
      result = restoreHistoricalDocument(documentId, getOperationsForDocument(documentId), operationId, {
        getCurrentDocument: (id) => getDocument(id),
        createOperation,
        updateDocument,
      });
    } catch {
      result = { status: "error", operations: [], error: undefined };
    }
    setIsRestoring(false);
    switch (result.status) {
      case "restored":
        setRestorationMessage("Versão restaurada localmente. As novas alterações ficarão pendentes de sincronização.");
        break;
      case "nothing_to_restore":
        setRestorationMessage("O documento já está nessa versão.");
        break;
      case "historical_version_not_found":
        setRestorationMessage("A versão histórica não está mais disponível.");
        break;
      case "historical_document_deleted":
        setRestorationMessage("Uma versão excluída não pode ser restaurada nesta etapa.");
        break;
      case "current_document_not_found":
        setRestorationMessage("O documento atual não está disponível.");
        break;
      case "error":
        setRestorationMessage("Não foi possível restaurar esta versão.");
        break;
    }
  };
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
        {event.type === "SYNC_COMPLETED" && (syncChanges.sent.length + syncChanges.received.length + syncChanges.all.length > 0) && (
          <section className="mt-10" aria-live="polite">
            <h2 className="text-lg font-semibold">Sincronização</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {syncChanges.sent.length + syncChanges.received.length + syncChanges.all.length} alterações relacionadas a esta sincronização.
            </p>
            <button type="button" className="dashboard-text-button mt-4" onClick={() => setShowSyncChanges((visible) => !visible)}>
              {showSyncChanges ? "Ocultar alterações ←" : "Ver alterações →"}
            </button>
            {showSyncChanges && (
              <div className="mt-4 space-y-6">
                {syncChanges.sent.length > 0 && <SyncOperationGroup title="Alterações enviadas" operations={syncChanges.sent} expandedOperationId={expandedOperationId} onSelect={(id) => setExpandedOperationId((current) => current === id ? null : id)} getDocumentTitle={getDocumentTitle} isDocumentAvailable={isDocumentAvailable} />}
                {syncChanges.received.length > 0 && <SyncOperationGroup title="Alterações recebidas" operations={syncChanges.received} expandedOperationId={expandedOperationId} onSelect={(id) => setExpandedOperationId((current) => current === id ? null : id)} getDocumentTitle={getDocumentTitle} isDocumentAvailable={isDocumentAvailable} />}
                {syncChanges.all.length > 0 && <SyncOperationGroup title="Alterações processadas" operations={syncChanges.all} expandedOperationId={expandedOperationId} onSelect={(id) => setExpandedOperationId((current) => current === id ? null : id)} getDocumentTitle={getDocumentTitle} isDocumentAvailable={isDocumentAvailable} />}
              </div>
            )}
          </section>
        )}
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
              {canRestore && (
                <button type="button" className="dashboard-text-button mt-5 rounded-lg border-[var(--border)] px-4 py-2 text-sm" onClick={restoreVersion} disabled={isRestoring}>
                  {isRestoring ? "Restaurando..." : "Restaurar esta versão"}
                </button>
              )}
              {restorationMessage && (
                <p className="mt-4 text-sm text-[var(--text-secondary)]" role="status">{restorationMessage}</p>
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
