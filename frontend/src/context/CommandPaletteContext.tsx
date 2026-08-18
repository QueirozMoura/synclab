import React, { createContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { CommandPalette } from "../components/CommandPalette";

interface CommandPaletteContextType {
  isOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const CommandPaletteContext = createContext<CommandPaletteContextType | undefined>(undefined);

export const CommandPaletteProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isFirstOpenRef = useRef(true);

  const openCommandPalette = useCallback(() => {
    if (isFirstOpenRef.current) {
      isFirstOpenRef.current = false;
    }
    setIsOpen(true);
  }, []);

  const closeCommandPalette = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const isShortcut = isMac ? e.metaKey : e.ctrlKey;

      if (isShortcut && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openCommandPalette();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openCommandPalette]);

  return (
    <CommandPaletteContext.Provider value={{ isOpen, openCommandPalette, closeCommandPalette }}>
      {children}
      <CommandPalette isOpen={isOpen} onClose={closeCommandPalette} />
    </CommandPaletteContext.Provider>
  );
};