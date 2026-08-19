import React from "react";

export const StatusFooter: React.FC = () => {
  return (
    <div className="h-8 border-t border-[#464554] bg-[#13131b] px-6 flex items-center justify-end text-xs text-[#c7c4d7]">
      <div className="flex items-center gap-2">
        <div
          className="w-1.5 h-1.5 rounded-full bg-[#10b981]"
          style={{
            boxShadow: "0 0 4px rgba(16,185,129,0.5)",
          }}
        />
        <span>Saved locally</span>
      </div>
    </div>
  );
};
