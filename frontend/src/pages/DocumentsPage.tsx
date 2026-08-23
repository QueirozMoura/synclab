import React from "react";
import { useNavigate } from "react-router-dom";
import { GlobalSidebar } from "../components/app/GlobalSidebar";
import { WorkspaceSidebar } from "../components/app/WorkspaceSidebar";
import { DocumentCard } from "../components/dashboard/DocumentCard";
import { useDocuments } from "../hooks/useDocuments";
import { DocumentDeleteDialog } from "../components/app/DocumentDeleteDialog";

export const DocumentsPage: React.FC = () => {
  const { documents, createDocument, deleteDocument } = useDocuments();
  const navigate = useNavigate();
  const [documentToDelete, setDocumentToDelete] = React.useState<{ id: string; title: string } | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<{ tone: "success" | "error"; message: string } | null>(null);

  const handleNewDocument = () => {
    const document = createDocument();
    navigate(`/app/documents/${document.id}`);
  };

  const handleDelete = async () => {
    if (!documentToDelete || deletingId) return;
    const target = documentToDelete;
    setDeletingId(target.id);
    setFeedback(null);
    try {
      await deleteDocument(target.id);
      setDocumentToDelete(null);
      setFeedback({ tone: "success", message: "Documento excluído." });
    } catch {
      setFeedback({ tone: "error", message: "Não foi possível excluir o documento." });
    } finally {
      setDeletingId(null);
    }
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
              <h1 className="text-3xl font-bold text-[#e4e1ed]">Documentos</h1>
              <button
                onClick={handleNewDocument}
                className="bg-[#c0c1ff] text-[#1000a9] px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <span>+</span>
                <span>Novo documento</span>
              </button>
            </div>
            {feedback && (
              <div className={`document-feedback ${feedback.tone} mb-5 rounded-lg px-3 py-2 text-xs`} role="status">
                {feedback.message}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents.map((doc) => (
                <div key={doc.id} className="relative">
                  <DocumentCard
                    title={doc.title}
                    icon={doc.id === "readme" ? "markdown" : doc.id.includes("code") || doc.id === "crdt-notes" ? "code" : "architecture"}
                    iconColor={doc.id === "readme" ? "#908fa0" : "#c0c1ff"}
                    timeAgo="Sincronizado recentemente"
                    href={`/app/documents/${doc.id}`}
                  />
                  <button
                    type="button"
                    aria-label={`Excluir documento ${doc.title}`}
                    title={`Excluir documento ${doc.title}`}
                    disabled={Boolean(deletingId)}
                    onClick={(event) => {
                      event.stopPropagation();
                      setDocumentToDelete({ id: doc.id, title: doc.title });
                    }}
                    className="document-card-delete absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-lg"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
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
                <span className="text-sm font-medium text-[#c7c4d7]">Criar novo documento</span>
              </button>
            </div>
          </div>
        </main>
      </div>
      {documentToDelete && (
        <DocumentDeleteDialog
          title={documentToDelete.title}
          isDeleting={Boolean(deletingId)}
          onCancel={() => setDocumentToDelete(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
};