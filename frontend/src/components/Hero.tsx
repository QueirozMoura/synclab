import React from "react";
import { Link } from "react-router-dom";

export const Hero: React.FC = () => {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden">
      {/* Subtle radial glow background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-96 h-96 md:w-[600px] md:h-[600px] rounded-full glow-lilac animate-glow-pulse"
          style={{
            background:
              "radial-gradient(circle, rgba(192, 193, 255, 0.08) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="container-main relative z-10">
        {/* Title */}
        <div className="text-center mb-6 animate-fade-in">
          <h1 className="text-h1 mb-2">
            Your documents.{" "}
            <span className="text-[#C0C1FF]">Everywhere.</span>
          </h1>
          <h2 className="text-h1 text-[#C0C1FF]">Even offline.</h2>
        </div>

        {/* Description */}
        <p className="text-center text-body-lg text-[#C7C4D7] max-w-2xl mx-auto mb-10 animate-fade-in">
          Synclab is an offline-first collaborative document engine built
          around CRDTs, local persistence, and deterministic synchronization.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in">
          <Link to="/app" className="btn-primary flex items-center gap-2">
            Open Synclab
            <span>→</span>
          </Link>
          <Link to="/app/documents/architecture" className="btn-secondary">View Architecture</Link>
        </div>
      </div>
    </section>
  );
};
