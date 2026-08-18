import React from "react";
import { ActivityItem } from "./ActivityItem";

export const ActivityPanel: React.FC = () => {
  const activities = [
    { title: "You edited Architecture Overview", timeAgo: "10 mins ago", dotColor: "#c0c1ff" },
    { title: "Device 'MacBook Pro' synced", timeAgo: "2 hours ago", dotColor: "#34343d" },
    { title: "Created CRDT Notes", timeAgo: "Yesterday", dotColor: "#34343d" },
  ];

  return (
    <div className="h-full bg-[#151517] border border-[#27272A] rounded-xl flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[#27272A] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[#c7c4d7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l4 2" />
          </svg>
          <h3 className="text-lg font-semibold text-[#e4e1ed]">Activity</h3>
        </div>
        <svg className="w-5 h-5 text-[#908fa0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-4 space-y-0">
        {activities.map((activity, index) => (
          <ActivityItem
            key={index}
            title={activity.title}
            timeAgo={activity.timeAgo}
            dotColor={activity.dotColor}
            isLast={index === activities.length - 1}
          />
        ))}
      </div>

      {/* Load more */}
      <div className="p-4 border-t border-[#27272A]">
        <button className="w-full text-center text-sm text-[#c7c4d7] hover:text-[#e4e1ed] transition-colors py-2">
          Load more
        </button>
      </div>
    </div>
  );
};