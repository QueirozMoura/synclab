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

  const syncStatus = !isOnline
    ? "offline"
    : isSyncPending
      ? "syncing"
      : syncFeedback === "error"
      ? "offline"
      : "synced";

  const syncText = !isOnline
    ? "Offline"
    : isSyncPending
      ? "Sincronizando..."
    : syncFeedback === "success"
      ? "Sincronização concluída"
      : syncFeedback === "error"
        ? "Falha na sincronização"
        : "Pronto para sincronizar";

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
    <div className="flex h-screen bg-[#09090B] overflow-hidden">
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
      <div className="flex-1 flex flex-col overflow-hidden lg:pl-0">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 py-8 md:py-12">
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 mt-8">
              {/* Documents Section - 8/12 columns on desktop */}
              <div className="lg:col-span-8">
                {/* Continue where you left off section */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-[#e4e1ed]">
                      Continue where you left off
                    </h2>
                    <Link
                      to="/app/documents"
                      className="text-sm text-[#c0c1ff] hover:underline transition-colors"
                    >
                      View all
                    </Link>
                  </div>

                  {/* Document Grid - 2 columns on desktop, 1 on mobile */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    <div className="space-y-4">
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
              <div className="lg:col-span-4 lg:self-start">
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