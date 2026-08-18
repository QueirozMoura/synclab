import React from "react";

type IconName = 
  | "search" 
  | "history" 
  | "star" 
  | "description" 
  | "settings" 
  | "help"
  | "note_add"
  | "manage_search"
  | "sync"
  | "update"
  | "architecture"
  | "code"
  | "markdown";

interface IconProps {
  name: IconName;
  className?: string;
  color?: string;
  strokeWidth?: number;
}

export const Icon: React.FC<IconProps> = ({ 
  name, 
  className = "w-5 h-5", 
  color = "currentColor",
  strokeWidth = 1.5 
}) => {
  const icons: Record<IconName, React.ReactElement> = {
    search: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
    history: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l4 2" />
      </svg>
    ),
    star: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
    description: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="13" x2="12" y2="17" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    ),
    settings: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
        <circle cx="12" cy="12" r="1" />
        <circle cx="12" cy="5" r="1" />
        <circle cx="12" cy="19" r="1" />
      </svg>
    ),
    help: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
    ),
    note_add: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    ),
    manage_search: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
        <path d="M9 9l6 6M15 9l-6 6" />
      </svg>
    ),
    sync: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
        <path d="M23 4v6h-6" />
        <path d="M1 20v-6h6" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
    ),
    update: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1 6.74-2.74L21 16" />
        <path d="M16 16h5v5" />
      </svg>
    ),
    architecture: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    code: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    markdown: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="13" x2="12" y2="17" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    ),
  };

  return icons[name] || null;
};