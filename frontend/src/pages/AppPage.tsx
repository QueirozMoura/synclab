import React from "react";
import { GlobalSidebar } from "../components/app/GlobalSidebar";
import { WorkspaceSidebar } from "../components/app/WorkspaceSidebar";
import { EditorHeader } from "../components/app/EditorHeader";
import { EditorContent } from "../components/app/EditorContent";
import { EditorToolbar } from "../components/app/EditorToolbar";
import { StatusFooter } from "../components/app/StatusFooter";

export const AppPage: React.FC = () => {
  const [activeDocument, setActiveDocument] = React.useState("Architecture");

  return (
    <div className="flex h-screen bg-[#13131b] overflow-hidden">
      {/* Global Sidebar */}
      <GlobalSidebar />

      {/* Workspace Sidebar */}
      <WorkspaceSidebar
        activeDocument={activeDocument}
        onSelectDocument={setActiveDocument}
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <EditorHeader title={activeDocument} />

        {/* Content */}
        <EditorContent />

        {/* Floating Toolbar */}
        <EditorToolbar />

        {/* Status Footer */}
        <StatusFooter />
      </div>
    </div>
  );
};
