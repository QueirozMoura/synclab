import React from "react";
import { Link } from "react-router-dom";
import { DashboardSidebar } from "../components/dashboard/DashboardSidebar";
import { DashboardHeader } from "../components/dashboard/DashboardHeader";
import { DocumentCard } from "../components/dashboard/DocumentCard";
import { ActivityPanel } from "../components/dashboard/ActivityPanel";
import { MobileTopbar } from "../components/dashboard/MobileTopbar";
import { useDocuments } from "../hooks/useDocuments";
import type { SyncResult } from "../types/sync";

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
  } = useDocuments();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [isSyncPending, setIsSyncPending] = React.useState(false);
  const [syncFeedback, setSyncFeedback] = React.useState<"idle" | "success" | "error">("idle");
  const [syncErrorMessage, setSyncErrorMessage] = React.useState<string | null>(null);
  const [syncSummary, setSyncSummary] = React.useState<SyncResult | null>(null);

  const handleFilterClick = () => {
    console.log("Filter clicked");
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleSyncClick = async () => {
    if (isSyncPending || !isOnline) {
      return;
    }

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

  const syncStatus = isSyncPending ? "syncing" : syncState;

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
        `Operações enviadas: ${syncSummary.missingOperations.length}`,
        `Operações recebidas: ${syncSummary.acceptedOperations.length}`,
        `Snapshots processados: ${syncSummary.snapshots.length}`,
      ]
      : syncFeedback === "error" && syncErrorMessage
        ? [syncErrorMessage]
        : [];

  const featuredDoc = documents[0];
  const compactDocs = documents.slice(1, 3);

  return (
    <div className="dashboard-page flex h-screen overflow-hidden">
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
      <DashboardSidebar />

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
            />

            {/* Main Grid: Documents (8/12) + Activity (4/12) on desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-8 mt-9">
              {/* Documents Section - 8/12 columns on desktop */}
              <div className="lg:col-span-8">
                {/* Continue where you left off section */}
                <div className="mb-8">
                  <div className="dashboard-section-heading flex items-end justify-between mb-5">
                    <div>
                      <p className="dashboard-kicker">Workspace</p>
                      <h2 className="text-xl font-semibold text-[#f4f1f8]">
                        Continue where you left off
                      </h2>
                    </div>
                    <Link
                      to="/app/documents"
                      className="dashboard-text-link text-sm"
                    >
                      View all
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
                        timeAgo="Just now"
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
                            timeAgo="Synced recently"
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