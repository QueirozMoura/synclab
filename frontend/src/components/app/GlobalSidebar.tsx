import React from "react";
import { NavLink } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useDocuments } from "../../hooks/useDocuments";
import { useAuth } from "../../context/AuthContext";
import { LoginButton } from "../auth/LoginButton";

export const GlobalSidebar: React.FC = () => {
  const navigate = useNavigate();
  const { createDocument } = useDocuments();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const handleNewDocument = () => {
    if (!isAuthenticated || isAuthLoading) {
      navigate("/login");
      return;
    }
    const document = createDocument();
    navigate(`/app/documents/${document.id}`);
  };
  const navigationItems = [
    { id: "search", label: "Pesquisar", icon: "search", path: "/app/documents" },
    { id: "recent", label: "Recentes", icon: "history", path: "/app" },
    { id: "favorites", label: "Favoritos", icon: "star", path: "/app/favorites" },
    { id: "documents", label: "Documentos", icon: "description", path: "/app/documents" },
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
    <aside className="global-sidebar hidden lg:flex lg:w-64 flex-col">
      <div className="global-sidebar-glow" aria-hidden="true" />
      {/* Header */}
      <div className="global-sidebar-header">
        <div className="global-sidebar-brand">
          <div className="global-sidebar-logo" aria-hidden="true">S</div>
          <div className="min-w-0">
            <p className="global-sidebar-title">Synclab</p>
            <p className="global-sidebar-subtitle">Editor offline-first</p>
          </div>
        </div>
        {!isAuthenticated && !isAuthLoading && <LoginButton />}
        <button onClick={handleNewDocument} className="global-sidebar-cta" disabled={!isAuthenticated || isAuthLoading} aria-label={!isAuthenticated || isAuthLoading ? "Faça login para criar um documento" : "Novo documento"}>
          <span className="global-sidebar-cta-icon" aria-hidden="true">+</span>
          <span>Novo documento</span>
          <span className="global-sidebar-cta-shortcut" aria-hidden="true">⌘N</span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="global-nav" aria-label="Navegação principal">
        <p className="global-sidebar-section-label">Workspace</p>
        {navigationItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) => `global-sidebar-link ${isActive ? "is-active" : ""}`}
          >
            <span className="global-sidebar-link-icon">{getIcon(item.icon)}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="global-sidebar-footer">
        <p className="global-sidebar-section-label">Sistema</p>
        <NavLink
          to="/app/settings"
          className={({ isActive }) => `global-sidebar-link ${isActive ? "is-active" : ""}`}
        >
          <span className="global-sidebar-link-icon"><svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg></span>
          <span>Configurações</span>
        </NavLink>
        <NavLink
          to="/app/help"
          className={({ isActive }) => `global-sidebar-link ${isActive ? "is-active" : ""}`}
        >
          <span className="global-sidebar-link-icon"><svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg></span>
          <span>Ajuda</span>
        </NavLink>
      </div>
    </aside>
  );
};
