import React from "react";

export const EditorContent: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto bg-[#13131b]">
      <div className="mx-auto max-w-3xl px-8 py-16">
        {/* Main Title */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-[#e4e1ed] mb-1">
            Architecture
          </h1>
          <div className="w-12 h-1 bg-gradient-to-r from-[#c0c1ff] to-transparent rounded" />
        </div>

        {/* Intro */}
        <blockquote className="mb-12 pl-4 border-l-2 border-[#464554] text-[#c7c4d7] italic">
          <p>
            Synclab is an offline-first collaborative document engine. Designed
            for high-performance environments, it ensures that your thoughts are
            captured instantly, regardless of network connectivity, and
            seamlessly merged with your team's contributions.
          </p>
        </blockquote>

        {/* Core Architecture Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-[#e4e1ed] mb-4">
            Core Architecture
          </h2>
          <blockquote className="pl-4 border-l-2 border-[#464554] text-[#c7c4d7] italic mb-6">
            <p>
              The system uses CRDTs (Conflict-free Replicated Data Types) to
              guarantee deterministic convergence across all client states. This
              foundational choice eliminates the need for central lock management
              or complex operational transformation servers.
            </p>
          </blockquote>

          {/* Local-first Approach Subsection */}
          <div className="ml-4">
            <h3 className="text-lg font-semibold text-[#e4e1ed] mb-3">
              Local-first Approach
            </h3>
            <blockquote className="pl-4 border-l-2 border-[#464554] text-[#c7c4d7] italic">
              <p>
                Changes are written locally to IndexedDB before synchronization
                is even attempted. The user interface updates optimistically,
                providing zero-latency feedback. Background workers then handle
                the gossiping of state vectors to connected peers.
              </p>
            </blockquote>
          </div>
        </section>

        {/* Code Block */}
        <div className="mb-12 rounded-lg overflow-hidden border border-[#464554]">
          {/* Code Header */}
          <div className="bg-[#1f1f27] border-b border-[#464554] px-4 py-3 flex items-center gap-3">
            <div className="flex gap-2">
              <div className="w-2 h-2 rounded-full bg-[#464554]" />
              <div className="w-2 h-2 rounded-full bg-[#464554]" />
              <div className="w-2 h-2 rounded-full bg-[#464554]" />
            </div>
            <span className="text-xs font-mono text-[#c0c1ff] flex-1">
              sync_engine.ts
            </span>
          </div>

          {/* Code Content */}
          <div className="bg-[#1f1f27] px-4 py-4 overflow-x-auto">
            <pre className="text-xs font-mono text-[#c7c4d7] leading-relaxed">
              <code>{`async function applyRemoteUpdate(update: Uint8Array) {
  // 1. Verify cryptographic signature
  if (!await verifySignature(update)) return;

  // 2. Merge into local CRDT document
  const transaction = doc.transact();
  Y.applyUpdate(doc, update, transaction);

  // 3. Persist merged state
  await storage.put(doc.encodeStateAsUpdate());
}`}</code>
            </pre>
          </div>
        </div>

        {/* Text after code */}
        <blockquote className="pl-4 border-l-2 border-[#464554] text-[#c7c4d7] italic">
          <p>
            The code above illustrates the core merge loop. Security is baked in
            at the lowest level, ensuring that malicious peers cannot corrupt
            the shared document state.
          </p>
        </blockquote>

        {/* Spacer for toolbar */}
        <div className="h-32" />
      </div>
    </div>
  );
};
