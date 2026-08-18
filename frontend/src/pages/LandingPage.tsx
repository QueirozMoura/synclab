import React from "react";
import { Navbar } from "../components/Navbar";
import { Hero } from "../components/Hero";
import { SyncDiagram } from "../components/SyncDiagram";
import { Features } from "../components/Features";
import { Footer } from "../components/Footer";

export const LandingPage: React.FC = () => {
  return (
    <>
      <Navbar />
      <main className="bg-[#09090B]">
        <Hero />
        <SyncDiagram />
        <Features />
      </main>
      <Footer />
    </>
  );
};