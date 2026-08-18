import React from "react";
import { FeatureCard } from "./FeatureCard";

const Terminal: React.FC = () => (
  <div className="bg-[#09090B] border border-[#27272A] rounded-lg p-4 font-mono text-sm text-[#C0C1FF] mt-4 overflow-hidden">
    <div className="space-y-2">
      <div>
        <span className="text-[#8083FF]">$</span>{" "}
        <span>indexedDB.open("synclab_store", 1);</span>
      </div>
      <div>
        <span className="text-[#4ADE80]">&gt;</span>{" "}
        <span className="text-[#C7C4D7]">Success: Local storage active.</span>
      </div>
    </div>
  </div>
);

const SyncStatus: React.FC = () => (
  <div className="mt-6 space-y-3">
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-[#4ADE80]" />
      <span className="text-body-md text-[#C7C4D7]">Synced</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-[#D97721] animate-pulse-amber" />
      <span className="text-body-md text-[#C7C4D7]">
        Syncing <span className="text-[#908FA0]">(3 pending)</span>
      </span>
    </div>
  </div>
);

const DatabaseIcon: React.FC = () => (
  <svg
    className="w-6 h-6"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <ellipse cx="12" cy="5" rx="8" ry="3" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M4 5v7c0 1.66 3.58 3 8 3s8-1.34 8-3V5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M4 12v7c0 1.66 3.58 3 8 3s8-1.34 8-3v-7" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const MergeIcon: React.FC = () => (
  <svg
    className="w-6 h-6"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="6" cy="18" r="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 6h6c2 0 3 1 3 3v6c0 2-1 3-3 3H8" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const WifiOffIcon: React.FC = () => (
  <svg
    className="w-6 h-6"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M1 9l6 6 2-2-8-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M6 13l7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M11 8c3.314 0 6.207.913 8.536 2.426" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M17 14l4.536 4.536" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const HistoryIcon: React.FC = () => (
  <svg
    className="w-6 h-6"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M12 7v5l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const Features: React.FC = () => {
  return (
    <section className="py-16 md:py-24 border-line">
      <div className="container-main">
        {/* Section Header */}
        <div className="mb-12 md:mb-16 text-center">
          <h2 className="text-h2 text-[#E4E1ED] mb-3">
            Engineered for resilience
          </h2>
          <p className="text-body-lg text-[#C7C4D7]">
            Technical minimalism meets deterministic sync.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-stagger-children">
          {/* Card 1: Local-First Architecture */}
          <FeatureCard
            title="Local-First Architecture"
            description="Data lives on your device first. Interactions are instant, governed by local persistence. The network is treated as an optional enhancement, not a dependency."
            icon={<DatabaseIcon />}
            variant="large-left"
          >
            <Terminal />
          </FeatureCard>

          {/* Card 2: CRDT-Powered */}
          <FeatureCard
            title="CRDT-Powered"
            description="Conflict-Free Replicated Data Types ensure deterministic merging. Concurrent edits resolve mathematically without manual intervention."
            icon={<MergeIcon />}
          />

          {/* Card 3: Unreliable Networks */}
          <FeatureCard
            title="Unreliable Networks"
            description="Built for trains, tunnels, and terrible Wi-Fi. Edits queue locally and sync optimistically when connectivity returns."
            icon={<WifiOffIcon />}
          />

          {/* Card 4: Reliable Sync State */}
          <FeatureCard
            title="Reliable Sync State"
            description="Clear, deterministic sync indicators. Never guess if your data is saved."
            icon={<HistoryIcon />}
            variant="large-right"
          >
            <div className="relative">
              <div
                className="absolute bottom-0 right-0 opacity-10 pointer-events-none"
                style={{
                  width: "120px",
                  height: "120px",
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-full h-full text-[#C0C1FF]"
                >
                  <circle cx="12" cy="12" r="10" opacity="0.3" />
                  <circle cx="12" cy="12" r="6" opacity="0.5" />
                </svg>
              </div>
              <SyncStatus />
            </div>
          </FeatureCard>
        </div>
      </div>
    </section>
  );
};
