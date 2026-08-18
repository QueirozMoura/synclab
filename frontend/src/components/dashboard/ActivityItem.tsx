import React from "react";

interface ActivityItemProps {
  title: string;
  timeAgo: string;
  dotColor?: string;
  isLast?: boolean;
}

export const ActivityItem: React.FC<ActivityItemProps> = ({
  title,
  timeAgo,
  dotColor = "#34343d",
  isLast = false,
}) => {
  return (
    <div className="flex gap-4 pb-6 relative last:pb-0">
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className="w-2 h-2 rounded-full relative z-10"
          style={{
            backgroundColor: dotColor,
            boxShadow: dotColor === "#c0c1ff" ? "0 0 0 2px #151517" : undefined,
          }}
        />
        {!isLast && (
          <div
            className="w-0.5 flex-1 mt-1"
            style={{
              backgroundColor: "#464554",
              opacity: 0.3,
            }}
          />
        )}
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm text-[#e4e1ed]">{title}</p>
        <p className="text-xs text-[#908fa0] mt-0.5">{timeAgo}</p>
      </div>
    </div>
  );
};