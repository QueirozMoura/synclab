import React from "react";
import { useNavigate } from "react-router-dom";
import { GlobalSidebar } from "../components/app/GlobalSidebar";
import { WorkspaceSidebar } from "../components/app/WorkspaceSidebar";
import { DocumentCard } from "../components/dashboard/DocumentCard";
import { useDocuments } from "../hooks/useDocuments";

export const DocumentsPage: React.FC = () => {
  const { documents, createDocument } = useDocuments();
  const navigate = useNavigate();

  const handleNewDocument = () => {
    const document = createDocument();
    navigate(`/app/documents/${document.id}`);
  };

  return (
    <div className="flex h-screen bg-[#13131b] overflow-hidden">
      <GlobalSidebar />
      <WorkspaceSidebar
        activeDocument="architecture"
        onSelectDocument={() => {}}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-8 py-8">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-3xl font-bold text-[#e4e1ed]">Documents</h1>
              <button
                onClick={handleNewDocument}
                className="bg-[#c0c1ff] text-[#1000a9] px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <span>+</span>
                <span>New Document</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  title={doc.title}
                  icon={doc.id === "readme" ? "markdown" : doc.id.includes("code") || doc.id === "crdt-notes" ? "code" : "architecture"}
                  iconColor={doc.id === "readme" ? "#908fa0" : "#c0c1ff"}
                  timeAgo="Synced recently"
                  href={`/app/documents/${doc.id}`}
                />
              ))}

              <button
                onClick={handleNewDocument}
                className="flex flex-col items-center justify-center p-8 bg-[#151517] border border-[#27272A] border-dashed rounded-xl hover:border-[#c0c1ff] hover:bg-[#1a1a1f] transition-colors cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full border-2 border-dashed border-[#464554] flex items-center justify-center mb-3 text-[#c0c1ff]">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-[#c7c4d7]">Create new document</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};