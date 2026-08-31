import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useDocuments } from "../../hooks/useDocuments";
import { useAuth } from "../../context/AuthContext";
import { LoginButton } from "../auth/LoginButton";

interface GlobalSidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export const GlobalSidebar: React.FC<GlobalSidebarProps> = ({ mobileOpen, onClose }) => {
  const navigate = useNavigate();
  const [internalMobileOpen, setInternalMobileOpen] = React.useState(false);
  const isControlled = mobileOpen !== undefined;
  const isMobileOpen = isControlled ? mobileOpen : internalMobileOpen;
  const closeMobileNavigation = () => {
    setInternalMobileOpen(false);
    onClose?.();
  };
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
    { id: "sync", label: "Sincronização", icon: "sync", path: "/app/sync" },
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
      case "sync":
        return (
          <svg
            className={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 21v-5h5" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {!isControlled && (
        <button
          type="button"
          className="global-mobile-topbar lg:hidden"
          aria-label="Abrir navegação"
          aria-expanded={isMobileOpen}
          onClick={() => setInternalMobileOpen(true)}
        >
          <span className="global-sidebar-logo" aria-hidden="true">S</span>
          <span className="global-mobile-topbar-title">Synclab</span>
          <span className="global-mobile-topbar-menu" aria-hidden="true">☰</span>
        </button>
      )}
      {!isControlled && isMobileOpen && (
        <button type="button" className="global-mobile-overlay lg:hidden" aria-label="Fechar navegação" onClick={closeMobileNavigation} />
      )}
      <aside className={`global-sidebar flex w-64 shrink-0 flex-col ${isMobileOpen ? "is-mobile-open" : ""}`}>
      <div className="global-sidebar-glow" aria-hidden="true" />
      {/* Header */}
      <div className="global-sidebar-header">
        <Link to="/app/" aria-label="Voltar ao ambiente" className="global-sidebar-brand cursor-pointer transition-opacity hover:opacity-80">
          <div className="global-sidebar-logo" aria-hidden="true">S</div>
          <div className="min-w-0">
            <p className="global-sidebar-title">Synclab</p>
            <p className="global-sidebar-subtitle">Editor offline-first</p>
          </div>
        </Link>
        {!isAuthenticated && !isAuthLoading && <LoginButton />}
        <button onClick={() => { handleNewDocument(); closeMobileNavigation(); }} className="global-sidebar-cta" disabled={!isAuthenticated || isAuthLoading} aria-label={!isAuthenticated || isAuthLoading ? "Faça login para criar um documento" : "Novo documento"}>
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
            onClick={closeMobileNavigation}
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
    </>
  );
};
