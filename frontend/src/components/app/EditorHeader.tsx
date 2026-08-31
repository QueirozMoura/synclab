import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

interface EditorHeaderProps {
  title: string;
  onMenuClick?: () => void;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({ title, onMenuClick }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [shareOpen, setShareOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    document.addEventListener("click", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      document.removeEventListener("click", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const displayName = user?.name ?? user?.email ?? "Usuário";
  const initials = displayName.trim().charAt(0).toUpperCase() || "U";
  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setAccountOpen(false);
    try {
      await logout();
      navigate("/", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleShare = () => {
    setShareOpen(!shareOpen);
    setMenuOpen(false);
  };

  const handleMenu = () => {
    setMenuOpen(!menuOpen);
    setShareOpen(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setShareOpen(false);
    // Could show a toast notification here
  };

  return (
    <div className="editor-header flex min-w-0 min-h-16 flex-wrap items-center justify-between gap-2 border-b border-[#464554] bg-[#13131b] px-3 py-2 sticky top-0 z-20 sm:px-6">
      {/* Left - Title and Metadata */}
      <div className="flex min-w-0 items-center gap-2">
        {onMenuClick && <button type="button" onClick={onMenuClick} aria-label="Abrir navegação" className="editor-mobile-menu lg:hidden">☰</button>}
        <Link to="/app" aria-label="Voltar ao ambiente" className="flex min-w-0 items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
        <div className="w-6 h-6 relative">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
          >
            <path
              d="M12 2L8 8L12 14L16 8Z"
              fill="#C0C1FF"
              opacity="0.8"
            />
            <path
              d="M12 10L16 16L20 10L16 14Z"
              fill="#8083FF"
              opacity="0.9"
            />
          </svg>
        </div>
        <div>
          <h1 className="max-w-[45vw] truncate text-base font-semibold text-[#e4e1ed] sm:max-w-none sm:text-lg">{title}</h1>
          <p className="text-xs text-[#908fa0] mt-1">Salvo localmente</p>
        </div>
        </Link>
      </div>

      {/* Right - Status, Share, Menu, Avatar */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        {/* Status Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1f1f27] border border-[#464554]">
          <div
            className="w-2 h-2 rounded-full bg-[#10b981]"
            style={{
              boxShadow: "0 0 8px rgba(16,185,129,0.5)",
            }}
          />
          <span className="text-xs text-[#e4e1ed]">Salvo localmente</span>
        </div>

        {/* Share Button */}
        <div className="relative">
          <button
            onClick={handleShare}
            className="editor-share-button hidden sm:inline-flex"
            aria-expanded={shareOpen}
            aria-haspopup="menu"
          >
            <span className="editor-share-icon" aria-hidden="true">+</span>
            <span>Compartilhar</span>
          </button>

          {shareOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-[#1b1b23] border border-[#464554] rounded-lg shadow-lg py-2 z-50 animate-fade-in">
              <button
                onClick={copyLink}
                className="w-full px-4 py-2 text-left text-sm text-[#e4e1ed] hover:bg-[#292932] flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copiar link
              </button>
              <div className="border-t border-[#464554] my-2" />
              <button className="w-full px-4 py-2 text-left text-sm text-[#e4e1ed] hover:bg-[#292932] flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Convidar pessoas
              </button>
            </div>
          )}
        </div>

        {/* Menu Button */}
        <div className="relative">
          <button
            onClick={handleMenu}
            className="p-2 hover:bg-[#1f1f27] rounded transition-colors text-[#c7c4d7]"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-[#1b1b23] border border-[#464554] rounded-lg shadow-lg py-2 z-50 animate-fade-in">
              <Link
                to="/app"
                className="block px-4 py-2 text-left text-sm text-[#e4e1ed] hover:bg-[#292932]"
                onClick={() => setMenuOpen(false)}
              >
                Ir para o painel
              </Link>
              <Link
                to="/app/documents"
                className="block px-4 py-2 text-left text-sm text-[#e4e1ed] hover:bg-[#292932]"
                onClick={() => setMenuOpen(false)}
              >
                Todos os documentos
              </Link>
              <div className="border-t border-[#464554] my-2" />
              <Link
                to="/app/settings"
                className="block px-4 py-2 text-left text-sm text-[#e4e1ed] hover:bg-[#292932]"
                onClick={() => setMenuOpen(false)}
              >
                Configurações
              </Link>
              <Link
                to="/app/help"
                className="block px-4 py-2 text-left text-sm text-[#e4e1ed] hover:bg-[#292932]"
                onClick={() => setMenuOpen(false)}
              >
                Ajuda
              </Link>
            </div>
          )}
        </div>

        {/* Account avatar */}
        <div ref={accountRef} className="relative">
          <button type="button" aria-label="Abrir menu da conta" aria-haspopup="menu" aria-expanded={accountOpen} onClick={() => setAccountOpen((open) => !open)} className="w-8 h-8 overflow-hidden rounded-full bg-gradient-to-br from-[#c0c1ff] to-[#8083ff] flex items-center justify-center text-white text-xs font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c0c1ff] focus-visible:outline-offset-2">
            {user?.avatarUrl ? <img src={user.avatarUrl} alt={`Avatar de ${displayName}`} className="h-full w-full object-cover" /> : initials}
          </button>
          {accountOpen && (
            <div role="menu" aria-label="Menu da conta" className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border-[#464554] bg-[#1b1b23] p-1.5 shadow-2xl animate-fade-in">
              <div className="flex items-center gap-3 border-b border-[#464554] px-3 py-3">
                <div className="w-9 h-9 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-[#c0c1ff] to-[#8083ff] flex items-center justify-center text-white text-xs font-bold">{user?.avatarUrl ? <img src={user.avatarUrl} alt={`Avatar de ${displayName}`} className="h-full w-full object-cover" /> : initials}</div>
                <div className="min-w-0"><p className="truncate text-sm font-medium text-[#e4e1ed]">{displayName}</p><p className="truncate text-xs text-[#908fa0]">{user?.email}</p></div>
              </div>
              <div className="border-b border-[#464554] py-1.5 text-xs text-[#c7c4d7]">
                <div className="flex items-center gap-2 px-3 py-1.5"><span className={`h-2 w-2 rounded-full ${isOnline ? "bg-[#10b981]" : "bg-[#f59e0b]"}`} />{isOnline ? "Online" : "Offline"}</div>
                <div className="px-3 py-1.5">✓ Salvo localmente</div>
              </div>
              <div className="py-1">
                <button type="button" role="menuitem" className="w-full rounded-lg px-3 py-2 text-left text-sm text-[#e4e1ed] hover:bg-[#292932]" onClick={() => setAccountOpen(false)}>Minha conta</button>
                <Link role="menuitem" to="/app/settings" className="block rounded-lg px-3 py-2 text-sm text-[#e4e1ed] hover:bg-[#292932]" onClick={() => setAccountOpen(false)}>Configurações</Link>
                <Link role="menuitem" to="/app" className="block rounded-lg px-3 py-2 text-sm text-[#e4e1ed] hover:bg-[#292932]" onClick={() => setAccountOpen(false)}>Voltar ao ambiente</Link>
              </div>
              <div className="border-t border-[#464554] pt-1"><button type="button" role="menuitem" disabled={isLoggingOut} className="w-full rounded-lg px-3 py-2 text-left text-sm text-[#ffaaa8] hover:bg-[#292932] disabled:opacity-60" onClick={() => void handleLogout()}>{isLoggingOut ? "Sair..." : "Sair"}</button></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
