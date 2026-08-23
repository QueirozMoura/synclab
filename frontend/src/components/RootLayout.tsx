import React from "react";
import { Outlet } from "react-router-dom";
import { CommandPaletteProvider } from "../context/CommandPaletteContext";
import { ThemeProvider } from "../context/ThemeContext";

export const RootLayout: React.FC = () => {
  return (
    <ThemeProvider>
      <CommandPaletteProvider>
        <Outlet />
      </CommandPaletteProvider>
    </ThemeProvider>
  );
};