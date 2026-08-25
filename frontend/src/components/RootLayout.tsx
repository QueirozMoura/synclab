import React from "react";
import { Outlet } from "react-router-dom";
import { CommandPaletteProvider } from "../context/CommandPaletteContext";
import { ThemeProvider } from "../context/ThemeContext";
import { AuthProvider } from "../context/AuthContext";

export const RootLayout: React.FC = () => {
  return (
    <ThemeProvider>
      <CommandPaletteProvider>
        <AuthProvider><Outlet /></AuthProvider>
      </CommandPaletteProvider>
    </ThemeProvider>
  );
};