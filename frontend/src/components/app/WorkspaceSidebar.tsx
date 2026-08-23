import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDocuments } from "../../hooks/useDocuments";
import { DocumentDeleteDialog } from "./DocumentDeleteDialog";

interface WorkspaceSidebarProps {
  onSelectDocument: (docName: string) => void;
  activeDocument: string;
  onDocumentDeleted?: () => void;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({ onDocumentDeleted }) => {
  const { documents, deleteDocument } = useDocuments();
  const location = useLocation();
  const navigate = useNavigate();
  const [documentToDelete, setDocumentToDelete] = useState<{ id: string; title: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const handleDelete = async () => {
    if (!documentToDelete || deletingId) return;

    const { id } = documentToDelete;
    setDeletingId(id);
    setFeedback(null);
    try {
      await deleteDocument(id);
      setDocumentToDelete(null);
      setFeedback({ tone: "success", message: "Documento excluído." });
      if (location.pathname === `/app/documents/${id}`) {
        onDocumentDeleted?.();
        navigate("/app/documents");
      }
    } catch {
      setFeedback({ tone: "error", message: "Não foi possível excluir o documento." });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="hidden md:flex md:w-64 flex-col bg-[#13131b] border-r border-[#464554] overflow-y-auto">
        <div className="p-4 border-b border-[#464554] flex items-center justify-between sticky top-0 bg-[#13131b]">
          <p className="text-xs font-semibold text-[#908fa0] uppercase tracking-wider">
            Engenharia
          </p>
          <Link
            to="/app/documents/new"
            aria-label="Criar novo documento"
            title="Criar novo documento"
            className="text-[#c0c1ff] hover:bg-[#1f1f27] p-2 rounded transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-2" aria-label="Documentos da área de trabalho">
          {documents.map((doc) => {
            const isActive = location.pathname === `/app/documents/${doc.id}`;
            const isDeleting = deletingId === doc.id;
            return (
              <div
                key={doc.id}
                className={`document-list-item group flex items-center gap-2 rounded-lg border ${isActive ? "is-active" : ""} ${isDeleting ? "is-deleting" : ""}`}
              >
                <Link
                  to={`/app/documents/${doc.id}`}
                  title={doc.title}
                  className="document-list-link flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-sm"
                >
                  <span className="document-list-icon" aria-hidden="true">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6" />
                    </svg>
                  </span>
                  <span className="truncate">{doc.title}</span>
                </Link>
                <button
                  type="button"
                  aria-label={`Excluir documento ${doc.title}`}
                  title={`Excluir documento ${doc.title}`}
                  disabled={Boolean(deletingId)}
                  onClick={() => setDocumentToDelete({ id: doc.id, title: doc.title })}
                  className="document-delete-button mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6" />
                  </svg>
                </button>
              </div>
            );
          })}
        </nav>
        {feedback && (
          <div className={`document-feedback mx-3 mb-3 rounded-lg px-3 py-2 text-xs ${feedback.tone}`} role="status">
            {feedback.message}
          </div>
        )}
      </div>

      {documentToDelete && (
        <DocumentDeleteDialog
          title={documentToDelete.title}
          isDeleting={Boolean(deletingId)}
          onCancel={() => setDocumentToDelete(null)}
          onConfirm={handleDelete}
        />
      )}
    </>
  );
};
