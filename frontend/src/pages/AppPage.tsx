import React from "react";
import { AppNavigation } from "../components/app/AppNavigation";
import { WorkspaceSidebar } from "../components/app/WorkspaceSidebar";
import { EditorHeader } from "../components/app/EditorHeader";
import { EditorContent } from "../components/app/EditorContent";
import { EditorToolbar } from "../components/app/EditorToolbar";
import { StatusFooter } from "../components/app/StatusFooter";

export const AppPage: React.FC = () => {
  const [activeDocument, setActiveDocument] = React.useState("Architecture");

  const noop = () => {};

  return (
    <div className="app-shell flex min-h-[100dvh] overflow-hidden bg-[#13131b]">
      <AppNavigation />

      {/* Workspace Sidebar */}
      <WorkspaceSidebar
        activeDocument={activeDocument}
        onSelectDocument={setActiveDocument}
      />

      {/* Main Content Area */}
      <div className="app-main flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <EditorHeader title={activeDocument} />

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
