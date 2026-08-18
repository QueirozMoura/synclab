import React from "react";
import { SyncStatus } from "./SyncStatus";

interface DashboardHeaderProps {
  onFilterClick?: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  onFilterClick,
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
        <SyncStatus status="synced" text="All devices synced" />
      </div>
      <div className="flex items-center gap-2">
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