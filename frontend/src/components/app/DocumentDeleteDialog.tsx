import React, { useEffect, useRef } from "react";

interface DocumentDeleteDialogProps {
  title: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const DocumentDeleteDialog: React.FC<DocumentDeleteDialogProps> = ({
  title,
  isDeleting,
  onCancel,
  onConfirm,
}) => {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isDeleting) onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDeleting, onCancel]);

  return (
    <div className="document-modal-backdrop fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
      <div
        className="document-confirm-modal w-full max-w-md rounded-xl border p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-document-title"
        aria-describedby="delete-document-description"
      >
        <div className="mb-5 flex items-start gap-3">
          <div className="document-modal-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" aria-hidden="true">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.3 3.7 2.9 17a2 2 0 0 0 1.75 3h14.7a2 2 0 0 0 1.75-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
            </svg>
          </div>
          <div>
            <h2 id="delete-document-title" className="text-lg font-semibold">Excluir documento?</h2>
            <p id="delete-document-description" className="mt-2 text-sm leading-relaxed">
              Tem certeza de que deseja excluir <strong className="break-words">“{title}”</strong>? Esta ação removerá o documento da sua lista.
            </p>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelButtonRef}
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="document-modal-button document-modal-cancel rounded-lg px-4 py-2.5 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="document-modal-button document-modal-confirm rounded-lg px-4 py-2.5 text-sm font-semibold"
          >
            {isDeleting ? "Excluindo..." : "Excluir documento"}
          </button>
        </div>
      </div>
    </div>
  );
};
