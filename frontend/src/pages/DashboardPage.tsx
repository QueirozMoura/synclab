import React from "react";
import { Link } from "react-router-dom";
import { DashboardSidebar } from "../components/dashboard/DashboardSidebar";
import { DashboardHeader } from "../components/dashboard/DashboardHeader";
import { DocumentCard } from "../components/dashboard/DocumentCard";
import { ActivityPanel } from "../components/dashboard/ActivityPanel";
import { MobileTopbar } from "../components/dashboard/MobileTopbar";
import { useDocuments } from "../hooks/useDocuments";
import type { SyncResult } from "../types/sync";
import type { SyncState } from "../lib/syncState";

const localizeSyncError = (message: string): string => {
  if (message === "Invalid sync response") return "Resposta de sincronização inválida";
  if (message === "SyncTransport not configured. Call setTransport() before sync().") {
    return "Transporte de sincronização não configurado.";
  }
  if (message.startsWith("HTTP error ")) return message.replace("HTTP error", "Erro HTTP");
  if (message.toLowerCase().includes("network")) return "Não foi possível conectar à rede.";
  return message;
};

const getDocumentIcon = (id: string) => {
  if (id === "readme") return { icon: "markdown", iconColor: "#908fa0" };
  if (id.includes("code") || id === "crdt-notes" || id === "architecture") return { icon: "code", iconColor: "#c0c1ff" };
  if (id === "roadmap-2024") return { icon: "architecture", iconColor: "#c0c1ff" };
  return { icon: "code", iconColor: "#ffb783" };
};

export const DashboardPage: React.FC = () => {
  const {
    documents,
    syncDocuments,
    getLastSyncError,
    getLastSuccessfulSyncAt,
    isOnline,
    syncState,
    getPendingOperationsForDocument,
    activity = [],
  } = useDocuments();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [isSyncPending, setIsSyncPending] = React.useState(false);
  const [syncFeedback, setSyncFeedback] = React.useState<"idle" | "success" | "error">("idle");
  const [syncErrorMessage, setSyncErrorMessage] = React.useState<string | null>(null);
  const [syncSummary, setSyncSummary] = React.useState<SyncResult | null>(null);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<"all" | "synced" | "pending" | "offline" | "error">("all");

  const getDocumentState = (docId: string): SyncState => {
    if (!isOnline) return "offline";
    if ((getPendingOperationsForDocument?.(docId) ?? 0) > 0) return "pending";
    if (syncFeedback === "error") return "error";
    return "synced";
  };

  const handleFilterClick = () => setFilterOpen((open) => !open);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleSyncClick = async () => {
    if (isSyncPending || !isOnline) return;

    setIsSyncPending(true);
    setSyncFeedback("idle");
    setSyncErrorMessage(null);
    setSyncSummary(null);

    try {
      const syncResult = await syncDocuments();
      setSyncSummary(syncResult);
      setSyncFeedback("success");
    } catch {
      const lastError = getLastSyncError();
      setSyncFeedback("error");
      setSyncErrorMessage(lastError?.message ?? "Erro ao sincronizar");
    } finally {
      setIsSyncPending(false);
    }
  };

  const syncStatus = isSyncPending ? "syncing" : syncFeedback === "error" ? "error" : syncState;

  const syncText = isSyncPending
    ? "Sincronizando..."
    : syncFeedback === "success"
      ? "Sincronização concluída"
      : syncFeedback === "error"
        ? "Falha na sincronização"
        : undefined;

  const syncDetails = isSyncPending
    ? []
    : syncFeedback === "success" && syncSummary
      ? [
        `Operações enviadas: ${new Set(syncSummary.sentOperationIds ?? []).size}`,
        `Operações recebidas: ${new Set(syncSummary.receivedOperationIds ?? []).size}`,
        `Snapshots processados: ${syncSummary.snapshots.length}`,
      ]
      : syncFeedback === "error" && syncErrorMessage
        ? [localizeSyncError(syncErrorMessage)]
        : [];

  const filteredDocuments = documents.filter((doc) => filter === "all" || getDocumentState(doc.id) === filter);
  const featuredDoc = filteredDocuments[0];
  const compactDocs = filteredDocuments.slice(1, 3);
  const pendingCount = documents.reduce((total, doc) => total + (getPendingOperationsForDocument?.(doc.id) ?? 0), 0);

  return (
    <div className="dashboard-page flex min-h-[100dvh] overflow-hidden">
      {/* Mobile Topbar */}
      <MobileTopbar onMenuClick={toggleSidebar} />

      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <DashboardSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="dashboard-main flex-1 flex flex-col overflow-hidden lg:pl-0">
        <main className="flex-1 overflow-y-auto">
          <div className="dashboard-content max-w-7xl mx-auto px-5 sm:px-8 py-8 md:py-12">
            {/* Dashboard Header */}
            <DashboardHeader
              onFilterClick={handleFilterClick}
              onSyncClick={handleSyncClick}
              isSyncing={isSyncPending || !isOnline}
              syncStatus={syncStatus}
              syncText={syncText}
                syncDetails={syncDetails}
                lastSuccessfulSyncAt={getLastSuccessfulSyncAt()}
                pendingCount={pendingCount}
              />
              <div className="dashboard-metrics mt-7 grid-cols-2 gap-3 md:grid-cols-3" aria-label="Resumo do workspace">
                <div className="dashboard-metric"><span className="dashboard-metric-icon" aria-hidden="true">◇</span><div><strong>{documents.length}</strong><span>documentos no workspace</span></div></div>
                <div className="dashboard-metric"><span className="dashboard-metric-icon" aria-hidden="true">↯</span><div><strong>{activity.length}</strong><span>eventos registrados</span></div></div>
                <div className="dashboard-metric col-span-2 md:col-span-1"><span className="dashboard-metric-icon" aria-hidden="true">◌</span><div><strong>{pendingCount}</strong><span>{pendingCount === 1 ? "alteração pendente" : "alterações pendentes"}</span></div></div>
              </div>
              {filterOpen && (
                <div className="relative z-10 mt-3 flex-wrap gap-2" role="group" aria-label="Filtros de documentos">
                  {(["all", "synced", "pending", "offline", "error"] as const).map((option) => (
                    <button key={option} type="button" className={`dashboard-button dashboard-button-secondary rounded-lg px-3 py-1.5 text-xs ${filter === option ? "ring-2 ring-[#c0c1ff]" : ""}`} onClick={() => { setFilter(option); setFilterOpen(false); }}>
                      {{ all: "Todos", synced: "Sincronizados", pending: "Alterações pendentes", offline: "Offline", error: "Com erro" }[option]}
                    </button>
                  ))}
                  {filter !== "all" && <button type="button" className="dashboard-text-button px-2 text-xs" onClick={() => { setFilter("all"); setFilterOpen(false); }}>Limpar filtros</button>}
                </div>
              )}

            {/* Main Grid: Documents (8/12) + Activity (4/12) on desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-8 mt-9">
              {/* Documents Section - 8/12 columns on desktop */}
              <div className="lg:col-span-8">
                {/* Continue where you left off section */}
                <div className="mb-8">
                  <div className="dashboard-section-heading flex items-end justify-between mb-5">
                    <div>
                      <p className="dashboard-kicker">Ambiente</p>
                      <h2 className="text-xl font-semibold text-[#f4f1f8]">
                        Continue de onde você parou
                      </h2>
                    </div>
                    <Link
                      to="/app/documents"
                      className="dashboard-text-link text-sm"
                    >
                      Ver todos
                    </Link>
                  </div>

                  {/* Document Grid - 2 columns on desktop, 1 on mobile */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Featured Card */}
                    {featuredDoc && (
                      <DocumentCard
                        featured
                        title={featuredDoc.title}
                        badge={featuredDoc.id}
                        badgeColor="#c0c1ff"
                        status={getDocumentState(featuredDoc.id) === "pending" ? "syncing" : getDocumentState(featuredDoc.id) === "offline" ? "offline" : "synced"}
                        timeAgo={new Date(featuredDoc.updatedAt).toLocaleString("pt-BR") }
                        href={`/app/documents/${featuredDoc.id}`}
                      />
                    )}

                    {/* Right column - compact cards */}
                    <div className="space-y-5">
                      {compactDocs.map((doc) => {
                        const { icon, iconColor } = getDocumentIcon(doc.id);
                        return (
                          <DocumentCard
                            key={doc.id}
                            title={doc.title}
                            icon={icon}
                            iconColor={iconColor}
                            status={getDocumentState(doc.id) === "pending" ? "syncing" : getDocumentState(doc.id) === "offline" ? "offline" : "synced"}
                            timeAgo={new Date(doc.updatedAt).toLocaleString("pt-BR")}
                            href={`/app/documents/${doc.id}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Activity Panel - 4/12 columns on desktop, full width on mobile */}
              <div className="hidden lg:block lg:col-span-4 lg:self-start">
                <ActivityPanel />
              </div>
            </div>

            {/* Activity Panel Mobile - below documents (hidden on desktop) */}
            <div className="lg:hidden mt-8">
              <ActivityPanel />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};