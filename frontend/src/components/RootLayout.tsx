import React from "react";
import { Outlet } from "react-router-dom";
import { CommandPaletteProvider } from "../context/CommandPaletteContext";

export const RootLayout: React.FC = () => {
  return (
    <CommandPaletteProvider>
      <Outlet />
    </CommandPaletteProvider>
  );
};