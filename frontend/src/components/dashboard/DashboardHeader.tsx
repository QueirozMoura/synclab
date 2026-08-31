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
  pendingCount?: number;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  onFilterClick,
  onSyncClick,
  isSyncing = false,
  syncStatus = "synced",
  syncText = "Todos os dispositivos sincronizados",
  syncDetails = [],
  lastSuccessfulSyncAt = null,
  pendingCount = 0,
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
        <p className="dashboard-kicker mb-3">Centro de controle · Synclab</p>
        <h1 className="text-3xl md:text-4xl font-bold text-[#f7f4fb] tracking-tight">
          {getGreeting()}, Gustavo.
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#a9a6b8]">
          Tudo o que você precisa para continuar trabalhando, online ou offline.
        </p>
      </div>

      <div className="dashboard-actions flex flex-wrap items-center gap-3">
        <button
          onClick={onSyncClick}
          disabled={isSyncing}
          aria-label={isSyncing ? "Sincronizando..." : "Sincronizar"}
          className="dashboard-button dashboard-button-primary flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg
            className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
          <span>
            {isSyncing
              ? "Sincronizando..."
              : syncStatus === "error"
                ? "Tentar novamente"
                : syncText === "Sincronização concluída"
                  ? "Sincronizado"
                  : "Sincronizar agora"}
          </span>
        </button>
        <button
          onClick={onFilterClick}
          aria-label="Filtrar documentos"
          className="dashboard-button dashboard-button-secondary flex items-center gap-2 px-4 py-2.5 text-sm rounded-lg"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <span>Filtrar</span>
        </button>
      </div>
      <div className={`dashboard-sync-hero dashboard-sync-hero-${syncStatus}`}>
        <div className="dashboard-sync-hero-main">
          <SyncStatus
            status={syncStatus}
            text={syncText}
            lastSuccessfulSyncAt={lastSuccessfulSyncAt}
          />
          <p className="mt-3 text-sm text-[#c7c4d7]">
            {syncStatus === "offline"
                ? `Suas alterações continuam salvas localmente e serão sincronizadas quando a conexão voltar. ${pendingCount} ${pendingCount === 1 ? "alteração pendente" : "alterações pendentes"}.`
              : syncStatus === "pending"
                ? `${pendingCount} ${pendingCount === 1 ? "alteração pendente" : "alterações pendentes"} serão sincronizadas assim que possível.`
                : syncStatus === "syncing"
                  ? "Estamos atualizando seus dispositivos."
                  : syncStatus === "error"
                    ? "Suas alterações locais estão preservadas. Tente novamente."
                    : "Seus dispositivos estão atualizados e prontos para continuar."}
          </p>
          {syncDetails.length > 0 && (
            <div
              className="dashboard-sync-details mt-3 text-xs"
              aria-label="Detalhes da sincronização"
            >
              {syncDetails.map((detail, index) => (
                <span key={`${detail}-${index}`}>{detail}</span>
              ))}
            </div>
          )}
        </div>
        <div
          className="dashboard-sync-hero-side"
          aria-label="Estado offline-first"
        >
          <span className="dashboard-sync-hero-icon" aria-hidden="true">
            ↯
          </span>
          <div>
            <strong>Offline-first</strong>
            <span>Salvo localmente primeiro</span>
          </div>
        </div>
      </div>
    </div>
  );
};
