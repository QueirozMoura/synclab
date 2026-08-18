import React from "react";
import { NavLink } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useDocuments } from "../../hooks/useDocuments";

export const GlobalSidebar: React.FC = () => {
  const navigate = useNavigate();
  const { createDocument } = useDocuments();

  const handleNewDocument = () => {
    const document = createDocument();
    navigate(`/app/documents/${document.id}`);
  };
  const navigationItems = [
    { id: "search", label: "Search", icon: "search", path: "/app/documents" },
    { id: "recent", label: "Recent", icon: "history", path: "/app" },
    { id: "favorites", label: "Favorites", icon: "star", path: "/app/favorites" },
    { id: "documents", label: "Documents", icon: "description", path: "/app/documents" },
  ];

  const getIcon = (name: string) => {
    const iconSize = "w-5 h-5";
    switch (name) {
      case "search":
        return (
          <svg
            className={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        );
      case "history":
        return (
          <svg
            className={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l4 2" />
          </svg>
        );
      case "star":
        return (
          <svg
            className={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        );
      case "description":
        return (
          <svg
            className={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="13" x2="12" y2="17" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="hidden lg:flex lg:w-64 flex-col bg-[#1b1b23] border-r border-[#464554]">
      {/* Header */}
      <div className="p-6 border-b border-[#464554]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-[#c0c1ff] flex items-center justify-center text-[#1000a9] text-xs font-bold">
            S
          </div>
          <div>
            <p className="text-sm font-semibold text-[#e4e1ed]">Synclab</p>
            <p className="text-xs text-[#c7c4d7]">Offline-first Editor</p>
          </div>
        </div>
        <button
          onClick={handleNewDocument}
          className="w-full bg-[#c0c1ff] text-[#1000a9] py-2 px-3 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <span>+</span>
          <span>New Document</span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigationItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors ${
              isActive
                ? "bg-[#34343d] text-[#c0c1ff]"
                : "text-[#c7c4d7] hover:bg-[#292932]"
            }`}
          >
            {getIcon(item.icon)}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-[#464554] p-4 space-y-2">
        <NavLink
          to="/app/settings"
          className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors ${
            isActive
              ? "bg-[#34343d] text-[#c0c1ff]"
              : "text-[#c7c4d7] hover:bg-[#292932]"
          }`}
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
          <span>Settings</span>
        </NavLink>
        <NavLink
          to="/app/help"
          className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors ${
            isActive
              ? "bg-[#34343d] text-[#c0c1ff]"
              : "text-[#c7c4d7] hover:bg-[#292932]"
          }`}
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <span>Help</span>
        </NavLink>
      </div>
    </div>
  );
};
