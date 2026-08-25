import React from "react";
import { Link, useParams } from "react-router-dom";
import { useDocuments } from "../hooks/useDocuments";

export const ActivityDetailsPage: React.FC = () => {
  const { activityId } = useParams<{ activityId: string }>();
  const { activity } = useDocuments();
  const event = activity.find((item) => item.id === activityId);

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
      </div>
    </main>
  );
};
