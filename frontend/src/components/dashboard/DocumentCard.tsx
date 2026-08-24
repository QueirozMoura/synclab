import React from "react";
import { Link } from "react-router-dom";

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
  href?: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
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
  href,
  isFavorite = false,
  onToggleFavorite,
}) => {
  const favoriteButton = onToggleFavorite ? (
    <button
      type="button"
      aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggleFavorite();
      }}
      className={`document-favorite-button ${isFavorite ? "is-favorite" : ""}`}
    >
      <svg viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <path d="m12 3 2.78 5.63 6.22.9-4.5 4.38 1.06 6.19L12 17.18l-5.56 2.92 1.06-6.19L3 9.53l6.22-.9L12 3Z" />
      </svg>
    </button>
  ) : null;
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

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  if (featured) {
    const content = (
      <div
        onClick={handleClick}
        className={`dashboard-document-card dashboard-document-card-featured relative h-48 md:h-[192px] rounded-2xl cursor-pointer overflow-hidden ${onToggleFavorite ? "document-card-has-actions" : ""}`}
      >
        {favoriteButton}
        <div className="p-6 h-full flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {badge && (
                <span
                  className="dashboard-card-badge px-2.5 py-1 text-xs font-medium rounded-md"
                  style={{ backgroundColor: `${badgeColor}20`, color: badgeColor }}
                >
                  {badge}
                </span>
              )}
            </div>
            {timeAgo && (
                <span className="dashboard-card-meta px-2 py-1 text-xs rounded-md">
                {timeAgo}
              </span>
            )}
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-[#f7f4fb] leading-tight">{title}</h3>
            {description && (
              <p className="text-sm text-[#b7b3c2] leading-relaxed line-clamp-2">
                {description}
              </p>
            )}
          </div>
        </div>
      </div>
    );

    if (href) {
      return <div className="relative"><Link to={href}>{content}</Link></div>;
    }
    return content;
  }

  const content = (
    <div
      onClick={handleClick}
      className={`dashboard-document-card relative flex items-center gap-4 p-4 rounded-2xl cursor-pointer ${onToggleFavorite ? "document-card-has-actions" : ""}`}
    >
      {favoriteButton}
      <div className="flex-shrink-0">{icon && getIcon(icon, iconColor)}</div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-[#e4e1ed] truncate">{title}</h3>
        <div className="flex items-center gap-2 mt-1">
          {getStatusDot()}
          <span className="text-xs text-[#c7c4d7]">{timeAgo || "Sincronizado"}</span>
        </div>
      </div>
    </div>
  );

  if (href) {
    return <div className="relative"><Link to={href}>{content}</Link></div>;
  }
  return content;
};