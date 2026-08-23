import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Icon } from "./Icon";
import { useNavigate } from "react-router-dom";
import { useDocuments } from "../hooks/useDocuments";

type IconName = 
  | "search" 
  | "history" 
  | "star" 
  | "description" 
  | "settings" 
  | "help"
  | "note_add"
  | "manage_search"
  | "sync"
  | "update"
  | "architecture"
  | "code"
  | "markdown";

interface Command {
  id: string;
  label: string;
  icon: IconName;
  shortcut?: string;
  action: () => void;
  section?: string;
  showIndicator?: boolean;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const isFirstOpenRef = useRef(true);
  const navigate = useNavigate();
  const { createDocument } = useDocuments();

  const handleNewDocument = useCallback(() => {
    const document = createDocument();
    navigate(`/app/documents/${document.id}`);
  }, [createDocument, navigate]);

  const commands = useMemo<Command[]>(
    () => [
      {
        id: "new-document",
        label: "Novo documento",
        icon: "note_add",
        shortcut: "↵",
        action: handleNewDocument,
        section: "suggestions",
      },
      {
        id: "search-documents",
        label: "Pesquisar documentos",
        icon: "manage_search",
        action: () => navigate("/app/documents"),
        section: "suggestions",
      },
      {
        id: "open-recent",
        label: "Abrir recentes",
        icon: "history",
        action: () => navigate("/app"),
        section: "suggestions",
      },
      {
        id: "sync-now",
        label: "Sincronizar agora",
        icon: "sync",
        action: () => {
          // Show syncing state visually
          console.log("Sync initiated");
        },
        section: "suggestions",
        showIndicator: true,
      },
      {
        id: "view-history",
        label: "Ver histórico",
        icon: "update",
        action: () => navigate("/app/documents/history"),
        section: "suggestions",
      },
      {
        id: "settings",
        label: "Configurações",
        icon: "settings",
        action: () => navigate("/app/settings"),
        section: "settings",
      },
    ],
    [handleNewDocument, navigate]
  );

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const lowerQuery = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lowerQuery) ||
        cmd.id.toLowerCase().includes(lowerQuery)
    );
  }, [query, commands]);

  const MAC_OS = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  const currentSection = useMemo(() => {
    if (!query.trim()) return null;
    const firstMatch = filteredCommands[0];
    return firstMatch?.section || null;
  }, [filteredCommands, query]);

  useEffect(() => {
    if (isOpen) {
      if (isFirstOpenRef.current) {
        isFirstOpenRef.current = false;
      } else {
        setQuery("");
        setSelectedIndex(0);
      }
      document.body.style.overflow = "hidden";
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      document.body.style.overflow = "";
      isFirstOpenRef.current = true;
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev >= filteredCommands.length - 1 ? 0 : prev + 1
        );
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev <= 0 ? filteredCommands.length - 1 : prev - 1
        );
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const command = filteredCommands[selectedIndex];
        if (command) {
          command.action();
          onClose();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose, navigate]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelectedIndex(0);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de comandos"
    >
      <div className="flex items-start justify-center pt-16 px-4">
        <div
          ref={inputRef}
          className="w-full max-w-[640px] bg-[#1b1b23] border border-[#464554] rounded-xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] overflow-hidden animate-fade-in"
        >
          <div className="relative">
            <div className="flex items-center gap-3 h-16 px-4 border-b border-[#27272A]">
              <Icon name="search" className="w-5 h-5 text-[#908fa0] flex-shrink-0" />
              <input
                type="text"
                value={query}
                onChange={handleInputChange}
                placeholder="Pesquisar comandos..."
                className="flex-1 bg-transparent text-[#e4e1ed] placeholder:text-[#908fa0] text-base outline-none font-medium"
                autoComplete="off"
                spellCheck={false}
                aria-label="Pesquisar comandos"
              />
              <span
                className="flex items-center gap-1 px-2 py-1 text-xs font-mono text-[#c7c4d7] bg-[#34343d] border border-[#464554] rounded"
              >
                {MAC_OS ? "⌘" : "Ctrl"} K
              </span>
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {filteredCommands.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Icon name="search" className="w-10 h-10 text-[#464554] mb-3" />
                <p className="text-sm text-[#908fa0]">Nenhum comando encontrado</p>
              </div>
            ) : (
              <>
                {(!query.trim() || currentSection) && (
                  <div
                    className="px-4 py-2 border-b border-[#27272A]"
                    style={{ opacity: query.trim() ? 0.5 : 1 }}
                  >
                    <span className="text-label text-[#908fa0]">
                      {currentSection === "settings" ? "CONFIGURAÇÕES" : "SUGESTÕES"}
                    </span>
                  </div>
                )}
                {filteredCommands.map((command, index) => {
                  const isSelected = index === selectedIndex;

                  return (
                    <button
                      key={command.id}
                      type="button"
                      onClick={() => {
                        command.action();
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        isSelected
                          ? "bg-[#292932] text-[#c0c1ff]"
                          : "text-[#c7c4d7] hover:bg-[#292932]"
                      }`}
                      style={{
                        borderLeft: isSelected
                          ? "2px solid #c0c1ff"
                          : "2px solid transparent",
                      }}
                      aria-selected={isSelected}
                      role="option"
                    >
                      <Icon
                        name={command.icon}
                        className={`w-5 h-5 flex-shrink-0 ${
                          isSelected ? "" : "opacity-60"
                        }`}
                      />
                      <span className="flex-1 text-sm font-medium">
                        {command.label}
                      </span>
                      {command.showIndicator && (
                        <span
                          className="w-2 h-2 rounded-full bg-[#c0c1ff] opacity-60"
                          style={{ boxShadow: "0 0 8px rgba(192,193,255,0.4)" }}
                        />
                      )}
                      {command.shortcut && (
                        <span className="text-xs font-mono text-[#908fa0]">
                          {command.shortcut}
                        </span>
                      )}
                    </button>
                  );
                })}
                {!query.trim() && (
                  <>
                    <div className="h-px bg-[#27272A] my-1" />
                    <div className="px-4 py-2">
                      <span className="text-label text-[#908fa0]">CONFIGURAÇÕES</span>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <div className="border-t border-[#27272A] px-4 py-3">
            <div className="flex items-center justify-center gap-4 text-xs">
              <kbd className="flex items-center gap-1 px-2 py-1 text-[#c7c4d7] bg-[#34343d] border border-[#464554] rounded shadow-sm font-mono">
                <span>↑</span>
                <span>↓</span>
                <span className="text-[#908fa0] px-1">para navegar</span>
              </kbd>
              <kbd className="flex items-center gap-1 px-2 py-1 text-[#c7c4d7] bg-[#34343d] border border-[#464554] rounded shadow-sm font-mono">
                <span>↵</span>
                <span className="text-[#908fa0] px-1">para selecionar</span>
              </kbd>
              <kbd className="flex items-center gap-1 px-2 py-1 text-[#c7c4d7] bg-[#34343d] border border-[#464554] rounded shadow-sm font-mono">
                <span>esc</span>
                <span className="text-[#908fa0] px-1">para fechar</span>
              </kbd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};