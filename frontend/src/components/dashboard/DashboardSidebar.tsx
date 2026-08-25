import React from "react";
import { NavLink } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useDocuments } from "../../hooks/useDocuments";
import { useAuth } from "../../context/AuthContext";

export const DashboardSidebar: React.FC = () => {
  const navigate = useNavigate();
  const { createDocument } = useDocuments();
  const { user, isAuthenticated, isLoading: isAuthLoading, logout } = useAuth();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const accountMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isAccountMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsAccountMenuOpen(false);
    };
    document.addEventListener("click", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAccountMenuOpen]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setIsAccountMenuOpen(false);
    try {
      await logout();
      navigate("/", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const displayName = user?.name ?? user?.email ?? "Usuário";
  const initials = displayName.trim().charAt(0).toUpperCase() || "U";
  const handleAccountToggle = () => {
    if (!isLoggingOut) setIsAccountMenuOpen((isOpen) => !isOpen);
  };

  const handleNewDocument = () => {
    if (!isAuthenticated || isAuthLoading) { navigate("/login"); return; }
    const document = createDocument();
    navigate(`/app/documents/${document.id}`);
  };

  const navigationItems = [
    { id: "search", label: "Pesquisar", icon: "search", path: "/app/documents" },
    { id: "recent", label: "Recentes", icon: "history", path: "/app" },
    { id: "favorites", label: "Favoritos", icon: "star", path: "/app/favorites" },
    { id: "documents", label: "Documentos", icon: "description", path: "/app/documents" },
  ];

  const footerItems = [
    { id: "settings", label: "Configurações", icon: "settings", path: "/app/settings" },
    { id: "help", label: "Ajuda", icon: "help", path: "/app/help" },
  ];

  const getIcon = (name: string) => {
    const iconSize = "w-5 h-5";
    switch (name) {
      case "search":
        return (
          <svg className={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        );
      case "history":
        return (
          <svg className={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l4 2" />
          </svg>
        );
      case "star":
        return (
          <svg className={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        );
      case "description":
        return (
          <svg className={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="13" x2="12" y2="17" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        );
      case "settings":
        return (
          <svg className={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        );
      case "help":
        return (
          <svg className={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="dashboard-sidebar hidden lg:flex lg:w-64 flex-col h-screen">
      {/* Header */}
      <div className="dashboard-sidebar-brand p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="dashboard-brand-mark w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold">
            S
          </div>
          <div>
            <p className="text-sm font-semibold text-[#e4e1ed]">Synclab</p>
            <p className="text-xs text-[#a9a5b7]">Ambiente offline-first</p>
          </div>
        </div>
        {!isAuthenticated && !isAuthLoading && <button onClick={() => navigate("/login")} className="dashboard-nav-item w-full px-3 py-2 text-left text-sm">Login</button>}
        <button
          onClick={handleNewDocument}
          className="dashboard-button dashboard-button-primary w-full py-2.5 px-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
        >
          <span>+</span>
          <span>Novo documento</span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1.5">
        {navigationItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) => `dashboard-nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              isActive
                ? "dashboard-nav-active text-[#e4e1ed]"
                : "text-[#a9a5b7]"
            }`}
          >
            {getIcon(item.icon)}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="dashboard-sidebar-footer p-4 space-y-1.5">
        {footerItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) => `dashboard-nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              isActive
                ? "dashboard-nav-active text-[#e4e1ed]"
                : "text-[#a9a5b7]"
            }`}
          >
            {getIcon(item.icon)}
            <span>{item.label}</span>
          </NavLink>
        ))}
        <div ref={accountMenuRef} className="relative mt-3 pt-4 border-t dashboard-profile">
          {isAccountMenuOpen && (
            <div role="menu" aria-label="Menu da conta" className="absolute bottom-full left-0 right-0 z-50 mb-2 rounded-xl border-[#464554] bg-[#1b1b26] p-1.5 shadow-2xl">
              <div className="flex items-center gap-3 border-b border-[#464554] px-3 py-2.5">
                <div className="w-8 h-8 shrink-0 rounded-full border-[#464554] bg-gradient-to-br from-[#c0c1ff] to-[#8083ff] flex items-center justify-center text-white text-xs font-bold">{initials}</div>
                <div className="min-w-0"><p className="text-sm font-medium text-[#e4e1ed] truncate">{displayName}</p><p className="text-xs text-[#908fa0] truncate">{user?.email}</p></div>
              </div>
              <div className="py-1">
                <button type="button" role="menuitem" className="dashboard-nav-item w-full rounded-lg px-3 py-2 text-left text-sm text-[#cbc8d6]" onClick={() => setIsAccountMenuOpen(false)}>Minha conta</button>
                <button type="button" role="menuitem" className="dashboard-nav-item w-full rounded-lg px-3 py-2 text-left text-sm text-[#cbc8d6]" onClick={() => { setIsAccountMenuOpen(false); navigate("/app/settings"); }}>Configurações</button>
              </div>
              <div className="border-t border-[#464554] pt-1"><button type="button" role="menuitem" disabled={isLoggingOut} className="dashboard-nav-item w-full rounded-lg px-3 py-2 text-left text-sm text-[#ffaaa8] disabled:cursor-wait disabled:opacity-60" onClick={() => void handleLogout()}>{isLoggingOut ? "Sair..." : "Sair"}</button></div>
            </div>
          )}
          <button type="button" aria-expanded={isAccountMenuOpen} aria-haspopup="menu" aria-label={`Abrir menu da conta de ${displayName}`} className="dashboard-profile-button dashboard-nav-item w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c0c1ff] focus-visible:outline-offset-2" onClick={handleAccountToggle}>
          <div className="w-8 h-8 rounded-full border border-[#464554] bg-gradient-to-br from-[#c0c1ff] to-[#8083ff] flex items-center justify-center text-white text-xs font-bold">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#e4e1ed] truncate">{displayName}</p>
            <p className="text-xs text-[#908fa0] truncate">Plano Pro</p>
          </div>
          </button>
        </div>
      </div>
    </div>
  );
};