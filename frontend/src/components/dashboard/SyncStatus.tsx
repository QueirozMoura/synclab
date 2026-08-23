import React from "react";

interface SyncStatusProps {
  status?: "synced" | "syncing" | "offline";
  text?: string;
  lastSuccessfulSyncAt?: number | null;
}

const formatLastSuccessfulSyncAt = (timestamp: number | null, now = Date.now()): string => {
  if (timestamp === null) return "Nunca sincronizado";

  const differenceInSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (differenceInSeconds < 60) return "agora";

  const minutes = Math.floor(differenceInSeconds / 60);
  if (minutes < 60) return `há ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} ${hours === 1 ? "hora" : "horas"}`;

  const days = Math.floor(hours / 24);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({
  status = "synced",
  text,
  lastSuccessfulSyncAt = null,
}) => {
  const getStatusStyles = () => {
    switch (status) {
      case "synced":
        return {
          dotColor: "#10b981",
          dotGlow: "0 0 8px rgba(16,185,129,0.5)",
          text: "All devices synced",
        };
      case "syncing":
        return {
          dotColor: "#d97721",
          dotGlow: "0 0 8px rgba(217,119,33,0.5)",
          text: "Syncing...",
        };
      case "offline":
        return {
          dotColor: "#ffb4ab",
          dotGlow: "0 0 8px rgba(255,180,171,0.5)",
          text: "Offline",
        };
      default:
        return {
          dotColor: "#10b981",
          dotGlow: "0 0 8px rgba(16,185,129,0.5)",
          text: "All devices synced",
        };
    }
  };

  const { dotColor, dotGlow, text: statusText } = getStatusStyles();

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1b1b23] border border-[#464554]">
      <div
        className="w-2 h-2 rounded-full"
        style={{
          backgroundColor: dotColor,
          boxShadow: dotGlow,
        }}
      />
      <span className="text-xs text-[#e4e1ed]">{text ?? statusText}</span>
      <span className="text-xs text-[#a9a6b8]" data-testid="last-sync-time">
        Última sincronização: {formatLastSuccessfulSyncAt(lastSuccessfulSyncAt)}
      </span>
    </div>
  );
};