import "./index.css";
import { useState } from "react";
import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { SyncDiagram } from "./components/SyncDiagram";
import { Features } from "./components/Features";
import { Footer } from "./components/Footer";
import { AppPage } from "./pages/AppPage";

function App() {
  const [currentPage, setCurrentPage] = useState<"landing" | "app">("landing");

  if (currentPage === "app") {
    return <AppPage />;
  }

  return (
    <>
      <Navbar onOpenApp={() => setCurrentPage("app")} />
      <main className="bg-[#09090B]">
        <Hero />
        <SyncDiagram />
        <Features />
      </main>
      <Footer />
    </>
  );
}

export default App;
