import React, { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { GlobalSidebar } from "../components/app/GlobalSidebar";
import { WorkspaceSidebar } from "../components/app/WorkspaceSidebar";
import { EditorHeader } from "../components/app/EditorHeader";
import { EditorToolbar } from "../components/app/EditorToolbar";
import { StatusFooter } from "../components/app/StatusFooter";
import { MarkdownPreview } from "../components/app/MarkdownPreview";
import { useDocuments } from "../hooks/useDocuments";
import { useOperationManager } from "../hooks/useOperationManager";
import { useAuth } from "../context/AuthContext";

export const EditorPage: React.FC = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const { getDocument, updateDocument } = useDocuments();
  const { createOperation } = useOperationManager();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const canEdit = isAuthenticated && !isAuthLoading;

  const document = getDocument(documentId || "");

  const [title, setTitle] = useState(() => document?.title || "");
  const [content, setContent] = useState(() => document?.content || "");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const isNewDocument = document ? (document.id === "new" || (document.content === "" && (document.title === "Untitled Document" || document.title === "Documento sem título"))) : false;
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPersistedContentRef = useRef<string>(document?.content || "");

  // Sync local state with document from context (one-way: context → local)
  // Only re-sync when document ID changes (document switch), not on content updates
  useEffect(() => {
    if (document) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle(document.title);
      setContent(document.content);
      lastPersistedContentRef.current = document.content;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document?.id]);

  const handleTitleChange = (newTitle: string) => {
    if (!canEdit) return;
    console.log("[Editor] handleTitleChange:", newTitle);

    // Don't create operation if no valid document
    if (!document) {
      setTitle(newTitle);
      return;
    }

    // Don't create operation if title hasn't actually changed
    if (newTitle === document.title) {
      setTitle(newTitle);
      return;
    }

    // Keep the previous title and reject empty or whitespace-only values.
    if (newTitle.trim().length === 0) {
      return;
    }

    setTitle(newTitle);

    // Create the operation first so the activity can reference its real id.
    console.log("[Editor] creating UPDATE_TITLE operation");
    const operation = createOperation(document.id, "UPDATE_TITLE", { type: "UPDATE_TITLE", title: newTitle }, document);
    console.log("[Editor] calling updateDocument for title:", document.id);
    updateDocument(document.id, { title: newTitle }, operation.id);
  };

  const handleContentChange = (newContent: string) => {
    if (!canEdit) return;
    console.log("[Editor] handleContentChange:", newContent.length, "chars");
    setContent(newContent);
    if (document) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        // Only persist and create operation if content actually changed
        if (newContent !== lastPersistedContentRef.current) {
          // Create the operation first so the activity can reference its real id.
          console.log("[Editor] creating UPDATE_CONTENT operation");
          const operation = createOperation(document.id, "UPDATE_CONTENT", { type: "UPDATE_CONTENT", content: newContent }, document);
          console.log("[Editor] debounced updateDocument for content:", document.id);
          updateDocument(document.id, { content: newContent }, operation.id);

          lastPersistedContentRef.current = newContent;
        }
      }, 300);
    }
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [documentId]);

  const applyFormat = useCallback((prefix: string, suffix: string = prefix) => {
    if (!canEdit) return;
    const textarea = contentRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.slice(start, end);
    const hasSelection = start !== end;

    let newContent: string;
    let newCursorPos: number;

    if (hasSelection) {
      newContent = content.slice(0, start) + prefix + selectedText + suffix + content.slice(end);
      newCursorPos = start + prefix.length + selectedText.length + suffix.length;
    } else {
      newContent = content.slice(0, start) + prefix + suffix + content.slice(start);
      newCursorPos = start + prefix.length;
    }

    setContent(newContent);
    if (document) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        if (newContent !== lastPersistedContentRef.current) {
          // Create the operation first so the activity can reference its real id.
          console.log("[Editor] creating UPDATE_CONTENT operation");
          const operation = createOperation(document.id, "UPDATE_CONTENT", { type: "UPDATE_CONTENT", content: newContent }, document);
          updateDocument(document.id, { content: newContent }, operation.id);

          lastPersistedContentRef.current = newContent;
        }
      }, 300);
    }

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [canEdit, content, document, updateDocument, createOperation]);

  const handleH1 = useCallback(() => applyFormat("# "), [applyFormat]);
  const handleH2 = useCallback(() => applyFormat("## "), [applyFormat]);
  const handleBold = useCallback(() => applyFormat("**", "**"), [applyFormat]);
  const handleItalic = useCallback(() => applyFormat("*", "*"), [applyFormat]);
  const handleCode = useCallback(() => applyFormat("`", "`"), [applyFormat]);

  const handleLink = useCallback(() => {
    if (!canEdit) return;
    const textarea = contentRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.slice(start, end);
    const hasSelection = start !== end;

    let newContent: string;
    let newCursorPos: number;

    if (hasSelection) {
      newContent = content.slice(0, start) + "[" + selectedText + "](https://)" + content.slice(end);
      newCursorPos = start + selectedText.length + 3 + 1 + 8; // [text](https://)
    } else {
      newContent = content.slice(0, start) + "[](https://)" + content.slice(start);
      newCursorPos = start + 1; // position after [
    }

    setContent(newContent);
    if (document) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        if (newContent !== lastPersistedContentRef.current) {
          // Create the operation first so the activity can reference its real id.
          console.log("[Editor] creating UPDATE_CONTENT operation");
          const operation = createOperation(document.id, "UPDATE_CONTENT", { type: "UPDATE_CONTENT", content: newContent }, document);
          updateDocument(document.id, { content: newContent }, operation.id);

          lastPersistedContentRef.current = newContent;
        }
      }, 300);
    }

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [canEdit, content, document, updateDocument, createOperation]);

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      contentRef.current?.focus();
    }
  };

  if (!document) {
    return (
      <div className="flex h-screen bg-[#13131b] overflow-hidden">
        <GlobalSidebar />
        <WorkspaceSidebar
          activeDocument="Not Found"
          onSelectDocument={() => {}}
        />

        <div className="flex flex-col flex-1 overflow-hidden">
          <EditorHeader title="Documento não encontrado" />
          <div className="flex-1 overflow-y-auto bg-[#13131b] flex items-center justify-center">
            <div className="mx-auto max-w-3xl px-8 py-16 text-center">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#464554] flex items-center justify-center mx-auto mb-6 text-[#c0c1ff]">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-[#e4e1ed] mb-2">Documento não encontrado</h1>
              <p className="text-[#c7c4d7] mb-8 max-w-md">
                O documento que você procura não existe ou pode ter sido excluído.
              </p>
            </div>
          </div>
          <EditorToolbar
            onH1={handleH1}
            onH2={handleH2}
            onBold={handleBold}
            onItalic={handleItalic}
            onCode={handleCode}
            onLink={handleLink}
          />
          <StatusFooter />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#13131b] overflow-hidden">
      <GlobalSidebar />
      <WorkspaceSidebar
        activeDocument={title}
        onSelectDocument={() => {}}
      />

      <div className="flex flex-col flex-1 overflow-hidden">
        <EditorHeader title={title} />
        <div className="flex-1 overflow-y-auto bg-[#13131b]">
          <div className="mx-auto max-w-3xl px-8 py-8">
            {/* Title Input */}
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              readOnly={!canEdit}
              onKeyDown={handleTitleKeyDown}
              placeholder="Documento sem título"
              className="w-full text-4xl font-bold text-[#e4e1ed] bg-transparent border-none outline-none placeholder-[#908fa0] mb-4"
              style={{ lineHeight: 1.1 }}
            />
            <div className="w-12 h-1 bg-gradient-to-r from-[#c0c1ff] to-transparent rounded mb-4" />

            {!canEdit && <div role="status" className="mb-4 rounded-lg border-[#464554] bg-[#1f1f27] px-4 py-3 text-sm text-[#c7c4d7]">Este documento está bloqueado para edição. Faça login para continuar.</div>}

            {/* Edit / Preview Toggle */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setMode("edit")}
                disabled={!canEdit}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === "edit"
                    ? "bg-[#c0c1ff] text-[#1000a9]"
                    : "bg-[#1f1f27] text-[#c7c4d7] hover:bg-[#292932]"
                }`}
              >
                Editar
              </button>
              <button
                onClick={() => setMode("preview")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === "preview"
                    ? "bg-[#c0c1ff] text-[#1000a9]"
                    : "bg-[#1f1f27] text-[#c7c4d7] hover:bg-[#292932]"
                }`}
              >
                Visualizar
              </button>
            </div>

            {/* Content Editor / Preview */}
            {mode === "edit" ? (
              <textarea
                ref={contentRef}
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                readOnly={!canEdit}
                placeholder={isNewDocument ? "Comece a escrever seu documento..." : ""}
                className="w-full min-h-[500px] bg-transparent border-none outline-none text-[#c7c4d7] placeholder-[#908fa0] text-base leading-relaxed resize-none font-mono"
                style={{ lineHeight: 1.7 }}
                spellCheck={false}
              />
            ) : (
              <MarkdownPreview content={content} />
            )}

            <div className="h-32" />
          </div>
        </div>
        {mode === "edit" && (
          <EditorToolbar
            onH1={handleH1}
            onH2={handleH2}
            onBold={handleBold}
            onItalic={handleItalic}
            onCode={handleCode}
            onLink={handleLink}
          />
        )}
        <StatusFooter />
      </div>
    </div>
  );
};