import React from "react";

interface DocumentCardProps {
  title: string;
  description?: string;
  badge?: string;
  badgeColor?: string;
  icon?: string;
  iconColor?: string;
  timeAgo?: string;
  status?: "synced" | "syncing" | "offline";
  featured?: boolean;
  onClick?: () => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  title,
  description,
  badge,
  badgeColor = "#c0c1ff",
  icon,
  iconColor = "#c7c4d7",
  timeAgo,
  status = "synced",
  featured = false,
  onClick,
}) => {
  const getIcon = (name: string, color: string) => {
    const iconSize = "w-10 h-10";
    switch (name) {
      case "architecture":
        return (
          <svg className={iconSize} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" style={{ color }}>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        );
      case "code":
        return (
          <svg className={iconSize} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" style={{ color }}>
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        );
      case "markdown":
        return (
          <svg className={iconSize} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" style={{ color }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="13" x2="12" y2="17" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        );
      default:
        return (
          <svg className={iconSize} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" style={{ color }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="13" x2="12" y2="17" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        );
    }
  };

  const getStatusDot = () => {
    switch (status) {
      case "synced":
        return (
          <span
            className="w-1.5 h-1.5 rounded-full bg-[#10b981]"
            style={{ boxShadow: "0 0 8px rgba(16,185,129,0.5)" }}
          />
        );
      case "syncing":
        return (
          <span
            className="w-1.5 h-1.5 rounded-full bg-[#d97721]"
            style={{ boxShadow: "0 0 8px rgba(217,119,33,0.5)" }}
          />
        );
      case "offline":
        return (
          <span
            className="w-1.5 h-1.5 rounded-full bg-[#ffb4ab]"
            style={{ boxShadow: "0 0 8px rgba(255,180,171,0.5)" }}
          />
        );
      default:
        return null;
    }
  };

  if (featured) {
    return (
      <div
        onClick={onClick}
        className="relative h-48 md:h-[192px] bg-[#151517] border border-[#27272A] rounded-xl cursor-pointer hover:bg-[#1a1a1f] transition-colors overflow-hidden"
      >
        <div className="p-6 h-full flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {badge && (
                <span
                  className="px-2 py-1 text-xs font-medium rounded"
                  style={{ backgroundColor: `${badgeColor}20`, color: badgeColor }}
                >
                  {badge}
                </span>
              )}
            </div>
            {timeAgo && (
              <span className="px-2 py-0.5 text-xs text-[#908fa0] bg-[#1b1b23] rounded">
                {timeAgo}
              </span>
            )}
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-[#e4e1ed] leading-tight">{title}</h3>
            {description && (
              <p className="text-sm text-[#c7c4d7] leading-relaxed line-clamp-2">
                {description}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 p-4 bg-[#151517] border border-[#27272A] rounded-xl cursor-pointer hover:bg-[#1a1a1f] transition-colors"
    >
      <div className="flex-shrink-0">{icon && getIcon(icon, iconColor)}</div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-[#e4e1ed] truncate">{title}</h3>
        <div className="flex items-center gap-2 mt-1">
          {getStatusDot()}
          <span className="text-xs text-[#c7c4d7]">{timeAgo || "Synced"}</span>
        </div>
      </div>
    </div>
  );
};