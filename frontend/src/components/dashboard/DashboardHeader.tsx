import React from "react";
import { SyncStatus } from "./SyncStatus";

interface DashboardHeaderProps {
  onFilterClick?: () => void;
  onSyncClick?: () => void;
  isSyncing?: boolean;
  syncStatus?: "synced" | "syncing" | "pending" | "offline" | "error";
  syncText?: string;
  syncDetails?: string[];
  lastSuccessfulSyncAt?: number | null;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  onFilterClick,
  onSyncClick,
  isSyncing = false,
  syncStatus = "synced",
  syncText = "Todos os dispositivos sincronizados",
  syncDetails = [],
  lastSuccessfulSyncAt = null,
}) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  return (
    <div className="dashboard-header flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6 mb-8">
      <div className="min-w-0">
        <p className="dashboard-kicker mb-3">Ambiente Synclab</p>
        <h1 className="text-3xl md:text-4xl font-bold text-[#f7f4fb] tracking-tight">
          {getGreeting()}, Gustavo.
        </h1>
        <SyncStatus
          status={syncStatus}
          text={syncText}
          lastSuccessfulSyncAt={lastSuccessfulSyncAt}
        />
        {syncDetails.length > 0 && (
          <div className="dashboard-sync-details mt-3 text-xs" aria-label="sync-details">
            {syncDetails.map((detail, index) => (
              <div key={`${detail}-${index}`}>{detail}</div>
            ))}
          </div>
        )}
      </div>
      <div className="dashboard-actions flex flex-wrap items-center gap-3">
        <button
          onClick={onSyncClick}
          disabled={isSyncing}
          className="dashboard-button dashboard-button-primary flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
          <span>{isSyncing ? "Sincronizando..." : "Sincronizar"}</span>
        </button>
        <button
          onClick={onFilterClick}
          className="dashboard-button dashboard-button-secondary flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <span>Filtrar</span>
        </button>
      </div>
    </div>
  );
};