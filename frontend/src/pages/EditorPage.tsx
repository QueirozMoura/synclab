import React, { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { GlobalSidebar } from "../components/app/GlobalSidebar";
import { WorkspaceSidebar } from "../components/app/WorkspaceSidebar";
import { EditorHeader } from "../components/app/EditorHeader";
import { EditorToolbar } from "../components/app/EditorToolbar";
import { StatusFooter } from "../components/app/StatusFooter";
import { useDocuments } from "../hooks/useDocuments";

export const EditorPage: React.FC = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const { getDocument, updateDocument } = useDocuments();

  const document = getDocument(documentId || "");

  const [title, setTitle] = useState(() => document?.title || "");
  const [content, setContent] = useState(() => document?.content || "");
  const isNewDocument = document ? (document.id === "new" || (document.content === "" && document.title === "Untitled Document")) : false;
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (document) {
      updateDocument(document.id, { title: newTitle });
    }
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    if (document) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        updateDocument(document.id, { content: newContent });
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
        updateDocument(document.id, { content: newContent });
      }, 300);
    }

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [content, document, updateDocument]);

  const handleH1 = useCallback(() => applyFormat("# "), [applyFormat]);
  const handleH2 = useCallback(() => applyFormat("## "), [applyFormat]);
  const handleBold = useCallback(() => applyFormat("**", "**"), [applyFormat]);
  const handleItalic = useCallback(() => applyFormat("*", "*"), [applyFormat]);
  const handleCode = useCallback(() => applyFormat("`", "`"), [applyFormat]);

  const handleLink = useCallback(() => {
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
        updateDocument(document.id, { content: newContent });
      }, 300);
    }

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [content, document, updateDocument]);

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
          <EditorHeader title="Document Not Found" />
          <div className="flex-1 overflow-y-auto bg-[#13131b] flex items-center justify-center">
            <div className="mx-auto max-w-3xl px-8 py-16 text-center">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#464554] flex items-center justify-center mx-auto mb-6 text-[#c0c1ff]">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-[#e4e1ed] mb-2">Document Not Found</h1>
              <p className="text-[#c7c4d7] mb-8 max-w-md">
                The document you're looking for doesn't exist or may have been deleted.
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
          <div key={documentId} className="mx-auto max-w-3xl px-8 py-8">
            {/* Title Input */}
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              placeholder="Untitled Document"
              className="w-full text-4xl font-bold text-[#e4e1ed] bg-transparent border-none outline-none placeholder-[#908fa0] mb-4"
              style={{ lineHeight: 1.1 }}
            />
            <div className="w-12 h-1 bg-gradient-to-r from-[#c0c1ff] to-transparent rounded mb-8" />

            {/* Content Editor */}
            <textarea
              ref={contentRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder={isNewDocument ? "Start writing your document..." : ""}
              className="w-full min-h-[500px] bg-transparent border-none outline-none text-[#c7c4d7] placeholder-[#908fa0] text-base leading-relaxed resize-none font-mono"
              style={{ lineHeight: 1.7 }}
              spellCheck={false}
            />

            <div className="h-32" />
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
};