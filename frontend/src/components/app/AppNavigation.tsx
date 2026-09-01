import React from "react";
import { GlobalSidebar } from "./GlobalSidebar";

export const AppNavigation: React.FC = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const handleViewportChange = () => {
      setIsMobile(mediaQuery.matches);
      if (!mediaQuery.matches) setIsOpen(false);
    };
    handleViewportChange();
    mediaQuery.addEventListener("change", handleViewportChange);
    return () => mediaQuery.removeEventListener("change", handleViewportChange);
  }, []);

  return (
    <>
      {isMobile && (
        <button
          type="button"
          aria-label="Abrir navegação"
          aria-expanded={isOpen}
          className="global-mobile-topbar"
          onClick={() => setIsOpen(true)}
        >
          <span className="global-sidebar-logo" aria-hidden="true">
            S
          </span>
          <span className="global-mobile-topbar-title">Synclab</span>
          <span className="global-mobile-topbar-menu" aria-hidden="true">
            ☰
          </span>
        </button>
      )}
      {isMobile && isOpen && (
        <button
          type="button"
          aria-label="Fechar navegação"
          className="global-mobile-overlay lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      <div className={`app-global-sidebar ${isOpen ? "is-open" : ""}`}>
        <GlobalSidebar mobileOpen={isOpen} onClose={() => setIsOpen(false)} />
      </div>
    </>
  );
};
