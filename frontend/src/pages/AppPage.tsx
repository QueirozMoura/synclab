import React from "react";
import { GlobalSidebar } from "../components/app/GlobalSidebar";
import { WorkspaceSidebar } from "../components/app/WorkspaceSidebar";
import { EditorHeader } from "../components/app/EditorHeader";
import { EditorContent } from "../components/app/EditorContent";
import { EditorToolbar } from "../components/app/EditorToolbar";
import { StatusFooter } from "../components/app/StatusFooter";

export const AppPage: React.FC = () => {
  const [activeDocument, setActiveDocument] = React.useState("Architecture");

  const noop = () => {};

  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <div className="app-shell flex min-h-[100dvh] overflow-hidden bg-[#13131b]">
      {mobileMenuOpen && <button type="button" aria-label="Fechar navegação" className="app-mobile-overlay fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileMenuOpen(false)} />}
      {/* Global Sidebar */}
      <div className={`app-global-sidebar ${mobileMenuOpen ? "is-open" : ""}`}><GlobalSidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} /></div>

      {/* Workspace Sidebar */}
      <WorkspaceSidebar
        activeDocument={activeDocument}
        onSelectDocument={setActiveDocument}
      />

      {/* Main Content Area */}
      <div className="app-main flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <EditorHeader title={activeDocument} onMenuClick={() => setMobileMenuOpen(true)} />

        {/* Content */}
        <EditorContent />

        {/* Floating Toolbar */}
        <EditorToolbar
          onH1={noop}
          onH2={noop}
          onBold={noop}
          onItalic={noop}
          onCode={noop}
          onLink={noop}
        />

        {/* Status Footer */}
        <StatusFooter />
      </div>
    </div>
  );
};
