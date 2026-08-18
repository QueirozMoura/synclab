import "./index.css";
import { useState, useEffect, useCallback } from "react";
import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { SyncDiagram } from "./components/SyncDiagram";
import { Features } from "./components/Features";
import { Footer } from "./components/Footer";
import { AppPage } from "./pages/AppPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CommandPalette } from "./components/CommandPalette";

function App() {
  const [currentPage, setCurrentPage] = useState<"landing" | "dashboard" | "app">("landing");
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const openCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(true);
  }, []);

  const closeCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(false);
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

  if (currentPage === "app") {
    return (
      <>
        <AppPage />
        <CommandPalette isOpen={isCommandPaletteOpen} onClose={closeCommandPalette} />
      </>
    );
  }

  if (currentPage === "dashboard") {
    return (
      <>
        <DashboardPage />
        <CommandPalette isOpen={isCommandPaletteOpen} onClose={closeCommandPalette} />
      </>
    );
  }

  return (
    <>
      <Navbar onOpenApp={() => setCurrentPage("app")} onOpenDashboard={() => setCurrentPage("dashboard")} />
      <main className="bg-[#09090B]">
        <Hero />
        <SyncDiagram />
        <Features />
      </main>
      <Footer />
      <CommandPalette isOpen={isCommandPaletteOpen} onClose={closeCommandPalette} />
    </>
  );
}

export default App;
