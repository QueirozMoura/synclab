import React from "react";

interface EditorHeaderProps {
  title: string;
  onShare?: () => void;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  title,
  onShare,
}) => {
  return (
    <div className="h-16 border-b border-[#464554] bg-[#13131b] px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Left - Title and Metadata */}
      <div>
        <h1 className="text-lg font-semibold text-[#e4e1ed]">{title}</h1>
        <p className="text-xs text-[#908fa0] mt-1">Edited 2 min ago</p>
      </div>

      {/* Right - Status, Share, Menu, Avatar */}
      <div className="flex items-center gap-4">
        {/* Status Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1f1f27] border border-[#464554]">
          <div
            className="w-2 h-2 rounded-full bg-[#10b981]"
            style={{
              boxShadow: "0 0 8px rgba(16,185,129,0.5)",
            }}
          />
          <span className="text-xs text-[#e4e1ed]">Synced</span>
        </div>

        {/* Share Button */}
        <button
          onClick={onShare}
          className="bg-[#c0c1ff] text-[#1000a9] px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity hidden sm:block"
        >
          Share
        </button>

        {/* Menu Button */}
        <button className="p-2 hover:bg-[#1f1f27] rounded transition-colors text-[#c7c4d7]">
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#c0c1ff] to-[#8083ff] flex items-center justify-center text-white text-xs font-bold">
          U
        </div>
      </div>
    </div>
  );
};
