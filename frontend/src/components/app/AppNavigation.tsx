import React from "react";
import { GlobalSidebar } from "./GlobalSidebar";

export const AppNavigation: React.FC = () => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Abrir navegação"
        aria-expanded={isOpen}
        className="global-mobile-topbar lg:hidden"
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
      {isOpen && (
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
