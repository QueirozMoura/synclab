import React from "react";

interface SyncStatusProps {
  status?: "synced" | "syncing" | "offline";
  text?: string;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({
  status = "synced",
  text = "All devices synced",
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
      <span className="text-xs text-[#e4e1ed]">{statusText || text}</span>
    </div>
  );
};