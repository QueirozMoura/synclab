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
  syncText = "All devices synced",
  syncDetails = [],
  lastSuccessfulSyncAt = null,
}) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-[#e4e1ed] tracking-tighter">
          {getGreeting()}, Gustavo.
        </h1>
        <SyncStatus
          status={syncStatus}
          text={syncText}
          lastSuccessfulSyncAt={lastSuccessfulSyncAt}
        />
        {syncDetails.length > 0 && (
          <div className="mt-2 text-xs text-[#c7c4d7]" aria-label="sync-details">
            {syncDetails.map((detail, index) => (
              <div key={`${detail}-${index}`}>{detail}</div>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onSyncClick}
          disabled={isSyncing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#c7c4d7] border border-[#27272A] rounded-md hover:bg-[#1f1f27] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
          <span>{isSyncing ? "Sincronizando..." : "Sincronizar"}</span>
        </button>
        <button
          onClick={onFilterClick}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#c7c4d7] border border-[#27272A] rounded-md hover:bg-[#1f1f27] transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <span>Filter</span>
        </button>
      </div>
    </div>
  );
};