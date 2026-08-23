import React from "react";

interface MobileTopbarProps {
  onMenuClick: () => void;
}

export const MobileTopbar: React.FC<MobileTopbarProps> = ({ onMenuClick }) => {
  return (
    <div className="dashboard-mobile-topbar lg:hidden fixed top-0 left-0 right-0 z-40 h-16 flex items-center justify-between px-5">
      <span className="font-semibold text-[#f7f4fb]">Synclab</span>
      <div className="flex items-center gap-2">
        <div className="dashboard-mobile-status flex items-center gap-1.5 px-2.5 py-1.5 rounded-full">
          <div
            className="w-1.5 h-1.5 rounded-full bg-[#10b981]"
            style={{ boxShadow: "0 0 6px rgba(16,185,129,0.5)" }}
          />
          <span className="text-xs text-[#e4e1ed]">Synced</span>
        </div>
        <button
          onClick={onMenuClick}
          className="dashboard-icon-button p-2 rounded-lg transition-colors text-[#c7c4d7]"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
      </div>
    </div>
  );
};