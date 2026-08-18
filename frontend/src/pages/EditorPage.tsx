import React from "react";
import { useParams } from "react-router-dom";
import { GlobalSidebar } from "../components/app/GlobalSidebar";
import { WorkspaceSidebar } from "../components/app/WorkspaceSidebar";
import { EditorHeader } from "../components/app/EditorHeader";
import { EditorToolbar } from "../components/app/EditorToolbar";
import { StatusFooter } from "../components/app/StatusFooter";
import { useDocuments } from "../hooks/useDocuments";

const documentContent: Record<string, React.ReactNode> = {
  "architecture": (
    <>
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-[#e4e1ed] mb-1">
          Architecture
        </h1>
        <div className="w-12 h-1 bg-gradient-to-r from-[#c0c1ff] to-transparent rounded" />
      </div>

      <blockquote className="mb-12 pl-4 border-l-2 border-[#464554] text-[#c7c4d7] italic">
        <p>
          Synclab is an offline-first collaborative document engine. Designed
          for high-performance environments, it ensures that your thoughts are
          captured instantly, regardless of network connectivity, and
          seamlessly merged with your team's contributions.
        </p>
      </blockquote>

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

      <div className="mb-12 rounded-lg overflow-hidden border border-[#464554]">
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

      <blockquote className="pl-4 border-l-2 border-[#464554] text-[#c7c4d7] italic">
        <p>
          The code above illustrates the core merge loop. Security is baked in
          at the lowest level, ensuring that malicious peers cannot corrupt
          the shared document state.
        </p>
      </blockquote>

      <div className="h-32" />
    </>
  ),
  "roadmap-2024": (
    <>
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-[#e4e1ed] mb-1">
          Roadmap 2024
        </h1>
        <div className="w-12 h-1 bg-gradient-to-r from-[#c0c1ff] to-transparent rounded" />
      </div>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-[#e4e1ed] mb-4">Q1 2024</h2>
        <ul className="space-y-3">
          <li className="flex items-center gap-3 p-4 bg-[#151517] border border-[#27272A] rounded-lg">
            <div className="w-2 h-2 rounded-full bg-[#4ADE80]" />
            <div>
              <p className="font-medium text-[#e4e1ed]">Core CRDT Engine v1.0</p>
              <p className="text-sm text-[#c7c4d7]">Yjs integration with custom providers</p>
            </div>
            <span className="px-2 py-1 text-xs font-medium rounded bg-[#4ADE80] text-[#09090B]">Done</span>
          </li>
          <li className="flex items-center gap-3 p-4 bg-[#151517] border border-[#27272A] rounded-lg">
            <div className="w-2 h-2 rounded-full bg-[#4ADE80]" />
            <div>
              <p className="font-medium text-[#e4e1ed]">Offline-first IndexedDB Persistence</p>
              <p className="text-sm text-[#c7c4d7]">Local storage with background sync</p>
            </div>
            <span className="px-2 py-1 text-xs font-medium rounded bg-[#4ADE80] text-[#09090B]">Done</span>
          </li>
          <li className="flex items-center gap-3 p-4 bg-[#151517] border border-[#27272A] rounded-lg">
            <div className="w-2 h-2 rounded-full bg-[#D97721]" />
            <div>
              <p className="font-medium text-[#e4e1ed]">Real-time Collaboration UI</p>
              <p className="text-sm text-[#c7c4d7]">Presence indicators, cursors, selections</p>
            </div>
            <span className="px-2 py-1 text-xs font-medium rounded bg-[#D97721] text-[#09090B]">In Progress</span>
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-[#e4e1ed] mb-4">Q2 2024</h2>
        <ul className="space-y-3">
          <li className="flex items-center gap-3 p-4 bg-[#151517] border border-[#27272A] rounded-lg">
            <div className="w-2 h-2 rounded-full bg-[#D97721]" />
            <div>
              <p className="font-medium text-[#e4e1ed]">Conflict Resolution UI</p>
              <p className="text-sm text-[#c7c4d7]">Visual merge conflict handling</p>
            </div>
            <span className="px-2 py-1 text-xs font-medium rounded bg-[#D97721] text-[#09090B]">Planned</span>
          </li>
          <li className="flex items-center gap-3 p-4 bg-[#151517] border border-[#27272A] rounded-lg">
            <div className="w-2 h-2 rounded-full bg-[#D97721]" />
            <div>
              <p className="font-medium text-[#e4e1ed]">Mobile Apps (iOS/Android)</p>
              <p className="text-sm text-[#c7c4d7]">React Native with Expo</p>
            </div>
            <span className="px-2 py-1 text-xs font-medium rounded bg-[#D97721] text-[#09090B]">Planned</span>
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-[#e4e1ed] mb-4">Q3-Q4 2024</h2>
        <ul className="space-y-3">
          <li className="flex items-center gap-3 p-4 bg-[#151517] border border-[#27272A] rounded-lg">
            <div className="w-2 h-2 rounded-full bg-[#908fa0]" />
            <div>
              <p className="font-medium text-[#e4e1ed]">Plugin System</p>
              <p className="text-sm text-[#c7c4d7]">Extensible architecture for custom features</p>
            </div>
            <span className="px-2 py-1 text-xs font-medium rounded bg-[#908fa0] text-[#09090B]">Research</span>
          </li>
          <li className="flex items-center gap-3 p-4 bg-[#151517] border border-[#27272A] rounded-lg">
            <div className="w-2 h-2 rounded-full bg-[#908fa0]" />
            <div>
              <p className="font-medium text-[#e4e1ed]">Enterprise SSO & RBAC</p>
              <p className="text-sm text-[#c7c4d7]">SAML, OIDC, fine-grained permissions</p>
            </div>
            <span className="px-2 py-1 text-xs font-medium rounded bg-[#908fa0] text-[#09090B]">Research</span>
          </li>
        </ul>
      </section>

      <div className="h-32" />
    </>
  ),
  "api-specs": (
    <>
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-[#e4e1ed] mb-1">
          API Specifications
        </h1>
        <div className="w-12 h-1 bg-gradient-to-r from-[#c0c1ff] to-transparent rounded" />
      </div>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-[#e4e1ed] mb-4">REST API</h2>
        <div className="space-y-4">
          <div className="p-4 bg-[#151517] border border-[#27272A] rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-1 text-xs font-medium rounded bg-[#4ADE80] text-[#09090B]">GET</span>
              <code className="text-sm font-mono text-[#c0c1ff]">/api/v1/documents</code>
            </div>
            <p className="text-sm text-[#c7c4d7]">List all documents for the authenticated user</p>
          </div>
          <div className="p-4 bg-[#151517] border border-[#27272A] rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-1 text-xs font-medium rounded bg-[#c0c1ff] text-[#09090B]">POST</span>
              <code className="text-sm font-mono text-[#c0c1ff]">/api/v1/documents</code>
            </div>
            <p className="text-sm text-[#c7c4d7]">Create a new document</p>
          </div>
          <div className="p-4 bg-[#151517] border border-[#27272A] rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-1 text-xs font-medium rounded bg-[#c0c1ff] text-[#09090B]">GET</span>
              <code className="text-sm font-mono text-[#c0c1ff]">/api/v1/documents/:id</code>
            </div>
            <p className="text-sm text-[#c7c4d7]">Get a specific document by ID</p>
          </div>
          <div className="p-4 bg-[#151517] border border-[#27272A] rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-1 text-xs font-medium rounded bg-[#D97721] text-[#09090B]">PATCH</span>
              <code className="text-sm font-mono text-[#c0c1ff]">/api/v1/documents/:id</code>
            </div>
            <p className="text-sm text-[#c7c4d7]">Update document metadata</p>
          </div>
          <div className="p-4 bg-[#151517] border border-[#27272A] rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-1 text-xs font-medium rounded bg-[#FFB4AB] text-[#09090B]">DELETE</span>
              <code className="text-sm font-mono text-[#c0c1ff]">/api/v1/documents/:id</code>
            </div>
            <p className="text-sm text-[#c7c4d7]">Delete a document</p>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-[#e4e1ed] mb-4">WebSocket API</h2>
        <div className="p-4 bg-[#151517] border border-[#27272A] rounded-lg">
          <p className="text-sm text-[#c7c4d7] mb-4">Real-time synchronization endpoint:</p>
          <code className="text-sm font-mono text-[#c0c1ff]">wss://api.synclab.io/v1/sync/:documentId</code>
          <div className="mt-4 space-y-2 text-xs text-[#c7c4d7]">
            <p>• Messages are encoded as binary CRDT updates</p>
            <p>• Automatic reconnection with exponential backoff</p>
            <p>• Presence and awareness protocol included</p>
          </div>
        </div>
      </section>

      <div className="h-32" />
    </>
  ),
  "meeting-notes": (
    <>
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-[#e4e1ed] mb-1">
          Meeting Notes
        </h1>
        <div className="w-12 h-1 bg-gradient-to-r from-[#c0c1ff] to-transparent rounded" />
      </div>

      <div className="space-y-6">
        <section className="p-4 bg-[#151517] border border-[#27272A] rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#e4e1ed]">Weekly Sync - Jan 15, 2024</h2>
            <span className="px-2 py-1 text-xs font-medium rounded bg-[#c0c1ff] text-[#09090B]">Team</span>
          </div>
          <ul className="space-y-2 text-sm text-[#c7c4d7]">
            <li>• CRDT engine performance review - 15% improvement in merge speed</li>
            <li>• Offline queue persistence - IndexedDB schema finalized</li>
            <li>• Mobile app prototype - React Native setup complete</li>
            <li>• Action: Gustavo to finalize sync protocol documentation</li>
          </ul>
        </section>

        <section className="p-4 bg-[#151517] border border-[#27272A] rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#e4e1ed]">Architecture Review - Jan 10, 2024</h2>
            <span className="px-2 py-1 text-xs font-medium rounded bg-[#8083FF] text-[#09090B]">Engineering</span>
          </div>
          <ul className="space-y-2 text-sm text-[#c7c4d7]">
            <li>• Discussed Yjs vs Automerge tradeoffs</li>
            <li>• Decided on Yjs for better ecosystem and performance</li>
            <li>• Custom WebRTC provider for P2P sync in progress</li>
            <li>• Action: Team to review provider implementation</li>
          </ul>
        </section>

        <section className="p-4 bg-[#151517] border border-[#27272A] rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#e4e1ed]">Product Planning - Jan 5, 2024</h2>
            <span className="px-2 py-1 text-xs font-medium rounded bg-[#D97721] text-[#09090B]">Product</span>
          </div>
          <ul className="space-y-2 text-sm text-[#c7c4d7]">
            <li>• Q1 priorities confirmed: Core engine, Offline sync, Basic collaboration</li>
            <li>• User research: 87% want offline-first, 92% want real-time collab</li>
            <li>• Pricing model discussion - freemium with team tiers</li>
            <li>• Action: Draft pricing page for review</li>
          </ul>
        </section>
      </div>

      <div className="h-32" />
    </>
  ),
  "crdt-notes": (
    <>
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-[#e4e1ed] mb-1">
          CRDT Notes
        </h1>
        <div className="w-12 h-1 bg-gradient-to-r from-[#c0c1ff] to-transparent rounded" />
      </div>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-[#e4e1ed] mb-4">What are CRDTs?</h2>
        <blockquote className="pl-4 border-l-2 border-[#464554] text-[#c7c4d7] italic mb-6">
          <p>
            Conflict-free Replicated Data Types (CRDTs) are data structures that
            automatically merge concurrent updates without requiring coordination
            between replicas. They provide strong eventual consistency guarantees.
          </p>
        </blockquote>
        
        <h3 className="text-lg font-semibold text-[#e4e1ed] mb-3">Key Properties</h3>
        <ul className="space-y-2 ml-4">
          <li className="flex items-center gap-2 text-sm text-[#c7c4d7]"><span className="w-2 h-2 rounded-full bg-[#c0c1ff]" /> Commutative: Order of operations doesn't matter</li>
          <li className="flex items-center gap-2 text-sm text-[#c7c4d7]"><span className="w-2 h-2 rounded-full bg-[#c0c1ff]" /> Associative: Grouping of operations doesn't matter</li>
          <li className="flex items-center gap-2 text-sm text-[#c7c4d7]"><span className="w-2 h-2 rounded-full bg-[#c0c1ff]" /> Idempotent: Duplicate operations have no effect</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-[#e4e1ed] mb-4">Types Used in Synclab</h2>
        <div className="space-y-4">
          <div className="p-4 bg-[#151517] border border-[#27272A] rounded-lg">
            <h3 className="font-medium text-[#e4e1ed] mb-2">Y.Text (Rich Text)</h3>
            <p className="text-sm text-[#c7c4d7]">Used for document content. Supports concurrent character/word insertions and deletions.</p>
          </div>
          <div className="p-4 bg-[#151517] border border-[#27272A] rounded-lg">
            <h3 className="font-medium text-[#e4e1ed] mb-2">Y.Map (Metadata)</h3>
            <p className="text-sm text-[#c7c4d7]">Document metadata, settings, and structured data.</p>
          </div>
          <div className="p-4 bg-[#151517] border border-[#27272A] rounded-lg">
            <h3 className="font-medium text-[#e4e1ed] mb-2">Y.Array (Lists)</h3>
            <p className="text-sm text-[#c7c4d7]">Ordered collections like document outlines, comments.</p>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-[#e4e1ed] mb-4">Sync Protocol</h2>
        <div className="p-4 bg-[#151517] border border-[#27272A] rounded-lg">
          <ol className="space-y-2 text-sm text-[#c7c4d7] list-decimal list-inside">
            <li>Local changes applied to Y.Doc immediately</li>
            <li>State vector computed and sent to peers</li>
            <li>Peers respond with missing updates</li>
            <li>Updates applied and merged automatically</li>
            <li>New state vector computed and persisted</li>
          </ol>
        </div>
      </section>

      <div className="h-32" />
    </>
  ),
  "readme": (
    <>
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-[#e4e1ed] mb-1">
          README.md
        </h1>
        <div className="w-12 h-1 bg-gradient-to-r from-[#c0c1ff] to-transparent rounded" />
      </div>

      <blockquote className="mb-12 pl-4 border-l-2 border-[#464554] text-[#c7c4d7] italic">
        <p>
          Synclab - An offline-first collaborative document engine built on CRDTs.
          Write anywhere, sync everywhere.
        </p>
      </blockquote>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-[#e4e1ed] mb-4">Features</h2>
        <ul className="space-y-3">
          <li className="flex items-center gap-3 p-3 bg-[#151517] border border-[#27272A] rounded-lg">
            <div className="w-2 h-2 rounded-full bg-[#4ADE80]" />
            <span className="text-sm text-[#e4e1ed]">Offline-first: Write without internet</span>
          </li>
          <li className="flex items-center gap-3 p-3 bg-[#151517] border border-[#27272A] rounded-lg">
            <div className="w-2 h-2 rounded-full bg-[#4ADE80]" />
            <span className="text-sm text-[#e4e1ed]">Real-time collaboration with CRDTs</span>
          </li>
          <li className="flex items-center gap-3 p-3 bg-[#151517] border border-[#27272A] rounded-lg">
            <div className="w-2 h-2 rounded-full bg-[#4ADE80]" />
            <span className="text-sm text-[#e4e1ed]">Markdown support with live preview</span>
          </li>
          <li className="flex items-center gap-3 p-3 bg-[#151517] border border-[#27272A] rounded-lg">
            <div className="w-2 h-2 rounded-full bg-[#4ADE80]" />
            <span className="text-sm text-[#e4e1ed]">Cross-platform: Web, Desktop, Mobile</span>
          </li>
          <li className="flex items-center gap-3 p-3 bg-[#151517] border border-[#27272A] rounded-lg">
            <div className="w-2 h-2 rounded-full bg-[#4ADE80]" />
            <span className="text-sm text-[#e4e1ed]">End-to-end encryption (planned)</span>
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-[#e4e1ed] mb-4">Quick Start</h2>
        <div className="mb-6 rounded-lg overflow-hidden border border-[#464554]">
          <div className="bg-[#1f1f27] border-b border-[#464554] px-4 py-3 flex items-center gap-3">
            <div className="flex gap-2">
              <div className="w-2 h-2 rounded-full bg-[#464554]" />
              <div className="w-2 h-2 rounded-full bg-[#464554]" />
              <div className="w-2 h-2 rounded-full bg-[#464554]" />
            </div>
            <span className="text-xs font-mono text-[#c0c1ff] flex-1">terminal</span>
          </div>
          <div className="bg-[#1f1f27] px-4 py-4 overflow-x-auto">
            <pre className="text-xs font-mono text-[#c7c4d7] leading-relaxed">
              <code>{`# Install CLI
npm install -g @synclab/cli

# Initialize project
synclab init my-docs
cd my-docs

# Start local server
synclab serve

# Open in browser
open http://localhost:3000`}</code>
            </pre>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-[#e4e1ed] mb-4">Architecture</h2>
        <div className="space-y-3 text-sm text-[#c7c4d7]">
          <p><strong>Core:</strong> Yjs CRDT library for conflict-free replication</p>
          <p><strong>Storage:</strong> IndexedDB (browser) / SQLite (native)</p>
          <p><strong>Network:</strong> WebRTC for P2P, WebSocket for relay</p>
          <p><strong>Frontend:</strong> React 19 + TypeScript + Tailwind CSS</p>
          <p><strong>Build:</strong> Vite + ESBuild</p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-[#e4e1ed] mb-4">Links</h2>
        <div className="space-y-2">
          <a href="https://github.com/synclab/synclab" target="_blank" rel="noopener noreferrer" className="text-[#c0c1ff] hover:underline">GitHub Repository</a>
          <a href="https://docs.synclab.io" target="_blank" rel="noopener noreferrer" className="text-[#c0c1ff] hover:underline">Documentation</a>
          <a href="https://discord.gg/synclab" target="_blank" rel="noopener noreferrer" className="text-[#c0c1ff] hover:underline">Discord Community</a>
        </div>
      </section>

      <div className="h-32" />
    </>
  ),
  "new": (
    <>
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#464554] flex items-center justify-center mb-6 text-[#c0c1ff]">
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="13" x2="12" y2="17" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-[#e4e1ed] mb-2">New Document</h1>
        <p className="text-[#c7c4d7] mb-8 max-w-md">
          Start writing your document. Changes are saved automatically and synced across all your devices.
        </p>
        <div className="w-full max-w-3xl">
          <div className="bg-[#151517] border border-[#27272A] rounded-xl min-h-[400px] p-8">
            <p className="text-[#908fa0] text-center py-20">Editor content will appear here</p>
          </div>
        </div>
        <div className="h-32" />
      </div>
    </>
  ),
};

export const EditorPage: React.FC = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const { getDocument } = useDocuments();

  const document = getDocument(documentId || "");

  if (!document) {
    return (
      <div className="flex h-screen bg-[#13131b] overflow-hidden">
        <GlobalSidebar />
        <WorkspaceSidebar
          activeDocument="Not Found"
          onSelectDocument={() => {}}
        />

        <div className="flex flex-col flex-1 overflow-hidden">
          <EditorHeader title="Document Not Found" />
          <div className="flex-1 overflow-y-auto bg-[#13131b] flex items-center justify-center">
            <div className="mx-auto max-w-3xl px-8 py-16 text-center">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#464554] flex items-center justify-center mx-auto mb-6 text-[#c0c1ff]">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-[#e4e1ed] mb-2">Document Not Found</h1>
              <p className="text-[#c7c4d7] mb-8 max-w-md">
                The document you're looking for doesn't exist or may have been deleted.
              </p>
            </div>
          </div>
          <EditorToolbar />
          <StatusFooter />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#13131b] overflow-hidden">
      <GlobalSidebar />
      <WorkspaceSidebar
        activeDocument={document.title}
        onSelectDocument={() => {}}
      />

      <div className="flex flex-col flex-1 overflow-hidden">
        <EditorHeader title={document.title} />
        <div className="flex-1 overflow-y-auto bg-[#13131b]">
          <div className="mx-auto max-w-3xl px-8 py-16">
            {documentContent[document.id] || (
              <div className="bg-[#151517] border border-[#27272A] rounded-xl min-h-[400px] p-8">
                <p className="text-[#908fa0] text-center py-20">Start writing your document...</p>
              </div>
            )}
          </div>
        </div>
        <EditorToolbar />
        <StatusFooter />
      </div>
    </div>
  );
};