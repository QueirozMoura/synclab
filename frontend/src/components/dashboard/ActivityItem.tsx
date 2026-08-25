import React from "react";

interface ActivityItemProps {
  title: string;
  timeAgo: string;
  dotColor?: string;
  icon?: string;
  action?: React.ReactNode;
  isLast?: boolean;
}

export const ActivityItem: React.FC<ActivityItemProps> = ({
  title,
  timeAgo,
  dotColor = "#34343d",
  icon = "•",
  action,
  isLast = false,
}) => {
  return (
    <div className="group flex gap-3 pb-5 relative last:pb-0 animate-[activity-in_300ms_ease-out_both]">
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs relative z-10 transition-transform duration-200 group-hover:scale-110"
          style={{
            color: dotColor,
            backgroundColor: `${dotColor}18`,
            boxShadow: `0 0 0 1px ${dotColor}35`,
          }}
          aria-hidden="true"
        >
          {icon}
        </div>
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
      <div className="flex-1 min-w-0 pt-1">
        <p className="text-sm font-medium text-[#e4e1ed] transition-colors duration-200 group-hover:text-white">{title}</p>
        <p className="text-xs text-[#908fa0] mt-1">{timeAgo}</p>
        {action}
      </div>
    </div>
  );
};