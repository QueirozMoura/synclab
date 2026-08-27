import React, { useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from "react";
import type { Document } from "../types/document";
import type { SyncPayload, SyncResult } from "../types/sync";
import type { SyncStatus } from "../lib/syncCoordinator";
import type { SyncState } from "../lib/syncState";
import { deriveSyncState } from "../lib/syncState";
import { DocumentsContext } from "./DocumentsContextType";
import { getAllDocuments, putDocument, deleteDocument as deleteDocumentIdb, recordActivity, getRecentActivity, type ActivityEvent } from "../lib/indexedDb";
import { useOperationManager } from "../hooks/useOperationManager";
import { useConnectivity } from "../hooks/useConnectivity";
import { AuthContext } from "./authContext";

export interface DocumentsContextType {
  documents: Document[];
  isLoading: boolean;
  isOnline: boolean;
  syncState: SyncState;
  createDocument: (title?: string) => Document;
  getDocument: (id: string) => Document | undefined;
  getPendingOperationsForDocument?: (id: string) => number;
  activity: ActivityEvent[];
  updateDocument: (id: string, data: Partial<Document>, operationId?: string) => void;
  toggleFavorite: (id: string) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  syncDocuments: () => Promise<SyncResult>;
  getSyncStatus: () => SyncStatus;
  isSyncing: () => boolean;
  getLastSyncResult: () => SyncResult | null;
  getLastSyncError: () => Error | null;
  getLastSuccessfulSyncAt: () => number | null;
  synchronizeDocument: (documentId: string, remotePayload: SyncPayload) => Promise<Document | null>;
  synchronizeAll: (remotePayload: SyncPayload) => Promise<SyncResult>;
}

const initialDocuments: Document[] = [
  {
    id: "roadmap-2024",
    title: "Roadmap 2024",
    content: `# Roadmap 2024

## Q1 2024
- [x] Core CRDT Engine v1.0 - Yjs integration with custom providers
- [x] Offline-first IndexedDB Persistence - Local storage with background sync
- [ ] Real-time Collaboration UI - Presence indicators, cursors, selections

## Q2 2024
- [ ] Conflict Resolution UI - Visual merge conflict handling
- [ ] Mobile Apps (iOS/Android) - React Native with Expo

## Q3-Q4 2024
- [ ] Plugin System - Extensible architecture for custom features
- [ ] Enterprise SSO & RBAC - SAML, OIDC, fine-grained permissions`,
    createdAt: "2024-01-15T10:00:00.000Z",
    updatedAt: "2024-01-15T10:00:00.000Z",
  },
  {
    id: "architecture",
    title: "Architecture",
    content: `# Architecture

> Synclab is an offline-first collaborative document engine. Designed for high-performance environments, it ensures that your thoughts are captured instantly, regardless of network connectivity, and seamlessly merged with your team's contributions.

## Core Architecture

> The system uses CRDTs (Conflict-free Replicated Data Types) to guarantee deterministic convergence across all client states. This foundational choice eliminates the need for central lock management or complex operational transformation servers.

### Local-first Approach

> Changes are written locally to IndexedDB before synchronization is even attempted. The user interface updates optimistically, providing zero-latency feedback. Background workers then handle the gossiping of state vectors to connected peers.

\`\`\`typescript
async function applyRemoteUpdate(update: Uint8Array) {
  // 1. Verify cryptographic signature
  if (!await verifySignature(update)) return;

  // 2. Merge into local CRDT document
  const transaction = doc.transact();
  Y.applyUpdate(doc, update, transaction);

  // 3. Persist merged state
  await storage.put(doc.encodeStateAsUpdate());
}
\`\`\`

> The code above illustrates the core merge loop. Security is baked in at the lowest level, ensuring that malicious peers cannot corrupt the shared document state.`,
    createdAt: "2024-01-10T10:00:00.000Z",
    updatedAt: "2024-01-10T10:00:00.000Z",
  },
  {
    id: "api-specs",
    title: "API Specifications",
    content: `# API Specifications

## REST API

**GET** \`/api/v1/documents\` - List all documents for the authenticated user

**POST** \`/api/v1/documents\` - Create a new document

**GET** \`/api/v1/documents/:id\` - Get a specific document by ID

**PATCH** \`/api/v1/documents/:id\` - Update document metadata

**DELETE** \`/api/v1/documents/:id\` - Delete a document

## WebSocket API

Real-time synchronization endpoint:
\`wss://api.synclab.io/v1/sync/:documentId\`

- Messages are encoded as binary CRDT updates
- Automatic reconnection with exponential backoff
- Presence and awareness protocol included`,
    createdAt: "2024-01-08T10:00:00.000Z",
    updatedAt: "2024-01-08T10:00:00.000Z",
  },
  {
    id: "meeting-notes",
    title: "Meeting Notes",
    content: `# Meeting Notes

## Weekly Sync - Jan 15, 2024 [Team]
- CRDT engine performance review - 15% improvement in merge speed
- Offline queue persistence - IndexedDB schema finalized
- Mobile app prototype - React Native setup complete
- Action: Gustavo to finalize sync protocol documentation

## Architecture Review - Jan 10, 2024 [Engineering]
- Discussed Yjs vs Automerge tradeoffs
- Decided on Yjs for better ecosystem and performance
- Custom WebRTC provider for P2P sync in progress
- Action: Team to review provider implementation

## Product Planning - Jan 5, 2024 [Product]
- Q1 priorities confirmed: Core engine, Offline sync, Basic collaboration
- User research: 87% want offline-first, 92% want real-time collab
- Pricing model discussion - freemium with team tiers
- Action: Draft pricing page for review`,
    createdAt: "2024-01-15T10:00:00.000Z",
    updatedAt: "2024-01-15T10:00:00.000Z",
  },
  {
    id: "crdt-notes",
    title: "CRDT Notes",
    content: `# CRDT Notes

## What are CRDTs?

> Conflict-free Replicated Data Types (CRDTs) are data structures that automatically merge concurrent updates without requiring coordination between replicas. They provide strong eventual consistency guarantees.

### Key Properties
- Commutative: Order of operations doesn't matter
- Associative: Grouping of operations doesn't matter
- Idempotent: Duplicate operations have no effect

## Types Used in Synclab

**Y.Text (Rich Text)** - Used for document content. Supports concurrent character/word insertions and deletions.

**Y.Map (Metadata)** - Document metadata, settings, and structured data.

**Y.Array (Lists)** - Ordered collections like document outlines, comments.

## Sync Protocol
1. Local changes applied to Y.Doc immediately
2. State vector computed and sent to peers
3. Peers respond with missing updates
4. Updates applied and merged automatically
5. New state vector computed and persisted`,
    createdAt: "2024-01-12T10:00:00.000Z",
    updatedAt: "2024-01-12T10:00:00.000Z",
  },
  {
    id: "readme",
    title: "README.md",
    content: `# README.md

> Synclab - An offline-first collaborative document engine built on CRDTs. Write anywhere, sync everywhere.

## Features
- ✅ Offline-first: Write without internet
- ✅ Real-time collaboration with CRDTs
- ✅ Markdown support with live preview
- ✅ Cross-platform: Web, Desktop, Mobile
- 🔒 End-to-end encryption (planned)

## Quick Start

\`\`\`bash
# Install CLI
npm install -g @synclab/cli

# Initialize project
synclab init my-docs
cd my-docs

# Start local server
synclab serve

# Open in browser
open http://localhost:3000
\`\`\`

## Architecture
- **Core:** Yjs CRDT library for conflict-free replication
- **Storage:** IndexedDB (browser) / SQLite (native)
- **Network:** WebRTC for P2P, WebSocket for relay
- **Frontend:** React 19 + TypeScript + Tailwind CSS
- **Build:** Vite + ESBuild

## Links
- [GitHub Repository](https://github.com/synclab/synclab)
- [Documentation](https://docs.synclab.io)
- [Discord Community](https://discord.gg/synclab)`,
    createdAt: "2024-01-01T10:00:00.000Z",
    updatedAt: "2024-01-01T10:00:00.000Z",
  },
];

void initialDocuments;

export const DocumentsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const isOnline = useConnectivity();
  const auth = React.useContext(AuthContext);
  // DocumentsProvider is also used independently in library/test contexts;
  // the application always supplies AuthProvider here.
  const isAuthenticated = auth?.isAuthenticated ?? true;
  const isAuthLoading = auth?.isLoading ?? false;
  const [isRefreshingAuth, setIsRefreshingAuth] = useState(false);
  const {
    createOperation,
    getOperationsForDocument,
    synchronizeDocument: syncDoc,
    synchronize,
    reconstructSyncedDocument,
    sync,
    getSyncStatus: getCoordinatorSyncStatus,
    isSyncing: isCoordinatorSyncing,
    getLastSyncResult: getCoordinatorLastSyncResult,
    getLastSyncError: getCoordinatorLastSyncError,
    getLastSuccessfulSyncAt: getCoordinatorLastSuccessfulSyncAt,
    hasPendingOperations,
  } = useOperationManager();

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        const storedActivity = await getRecentActivity();
        if (mounted) setActivity(storedActivity);
        console.log("[Context] Initializing - loading from IndexedDB");
        const storedDocuments = await getAllDocuments();
        console.log("[Context] Initialization - loaded documents:", storedDocuments.length);
        if (mounted) {
          if (storedDocuments.length > 0) {
            console.log("[Context] Using stored documents from IndexedDB");
            setDocuments(storedDocuments);
          } else {
            console.log("[Context] No stored documents, starting empty");
            setDocuments([]);
          }
        }
      } catch (error) {
        console.error("[DocumentsContext] Failed to initialize:", error);
        if (mounted) {
          setDocuments([]);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, []);

  const appendActivity = useCallback((event: Omit<ActivityEvent, "id" | "timestamp">) => {
    const fullEvent: ActivityEvent = { ...event, id: crypto.randomUUID(), timestamp: new Date().toISOString() };
    setActivity((current) => [fullEvent, ...current].slice(0, 100));
    if (typeof recordActivity === "function") void recordActivity(fullEvent);
  }, []);

  const createDocument = useCallback((title?: string): Document => {
    const now = new Date().toISOString();
    const newDoc: Document = {
      id: crypto.randomUUID(),
      title: title || "Documento sem título",
      content: "",
      createdAt: now,
      updatedAt: now,
    };
    setDocuments((prev) => [newDoc, ...prev]);
    putDocument(newDoc).catch((error) => {
      console.error("[DocumentsContext] Failed to persist new document:", error);
    });

    // Create the operation first so the activity can reference its real id.
    console.log("[Context] creating CREATE_DOCUMENT operation");
    const operation = createOperation(newDoc.id, "CREATE_DOCUMENT", {
      type: "CREATE_DOCUMENT",
      title: newDoc.title,
      content: newDoc.content,
    });
    appendActivity({ type: "DOCUMENT_CREATED", documentId: newDoc.id, documentTitle: newDoc.title, operationId: operation.id });

    return newDoc;
  }, [appendActivity, createOperation]);

  const getDocument = useCallback((id: string): Document | undefined => {
    return documents.find((doc) => doc.id === id);
  }, [documents]);

  const getPendingOperationsForDocument = useCallback((id: string): number => {
    return getOperationsForDocument(id).filter((operation) => operation.confirmedAt === undefined).length;
  }, [getOperationsForDocument]);

  const updateDocument = useCallback((id: string, data: Partial<Document>, operationId?: string) => {
    const currentDocument = documents.find((item) => item.id === id);
    if (currentDocument && (data.title !== undefined || data.content !== undefined)) appendActivity({ type: "DOCUMENT_UPDATED", documentId: id, documentTitle: data.title ?? currentDocument.title, operationId });
    console.log("[Context] updateDocument called:", { id, data });
    setDocuments((prev) => {
      const doc = prev.find((d) => d.id === id);
      console.log("[Context] updateDocument found doc:", doc ? { id: doc.id, title: doc.title } : "not found");
      if (doc) {
        const updatedDoc = { ...doc, ...data, updatedAt: new Date().toISOString() };
        console.log("[Context] updateDocument putting:", { id: updatedDoc.id, title: updatedDoc.title, contentLength: updatedDoc.content.length });
        putDocument(updatedDoc).catch((error) => {
          console.error("[DocumentsContext] Failed to persist document update:", error);
        });
      }
      return prev.map((doc) =>
        doc.id === id
          ? { ...doc, ...data, updatedAt: new Date().toISOString() }
          : doc
      );
    });
  }, [appendActivity, documents]);

  const toggleFavorite = useCallback(async (id: string): Promise<void> => {
    const document = documents.find((item) => item.id === id);
    if (!document) return;
    const updatedDocument = {
      ...document,
      isFavorite: !document.isFavorite,
      updatedAt: new Date().toISOString(),
    };
    await putDocument(updatedDocument);
    setDocuments((prev) => prev.map((item) => item.id === id ? updatedDocument : item));
  }, [documents]);

  const deleteDocument = useCallback(async (id: string): Promise<void> => {
    const document = documents.find((item) => item.id === id);
    if (!document) return;

    await deleteDocumentIdb(id);
    setDocuments((prev) => prev.filter((item) => item.id !== id));
    console.log("[Context] creating DELETE_DOCUMENT operation");
    createOperation(id, "DELETE_DOCUMENT", { type: "DELETE_DOCUMENT", deleted: true });
  }, [createOperation, documents]);

  const synchronizeDocument = useCallback(
    async (documentId: string, remotePayload: SyncPayload): Promise<Document | null> => {
      const { document } = await syncDoc(documentId, remotePayload);

      if (document) {
        setDocuments((prev) =>
          prev.map((doc) => (doc.id === documentId ? document : doc))
        );
        await putDocument(document);
      } else {
        setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
      }

      return document;
    },
    [syncDoc]
  );

  const synchronizeAll = useCallback(
    async (remotePayload: SyncPayload): Promise<SyncResult> => {
      const syncResult = await synchronize(remotePayload);

      const affectedDocIds = new Set<string>();

      for (const op of syncResult.acceptedOperations) {
        affectedDocIds.add(op.documentId);
      }

      for (const snapshot of syncResult.snapshots) {
        affectedDocIds.add(snapshot.documentId);
      }

      const reconstructedDocs = new Map<string, Document | null>();

      for (const docId of affectedDocIds) {
        const reconstructed = reconstructSyncedDocument(docId);
        reconstructedDocs.set(docId, reconstructed);
      }

      const updates: Array<{ docId: string; doc: Document | null }> = [];
      for (const [docId, doc] of reconstructedDocs) {
        updates.push({ docId, doc });
      }

      for (const { doc } of updates) {
        if (doc) {
          await putDocument(doc);
        }
      }

      setDocuments((prev) => {
        const docMap = new Map(prev.map((d) => [d.id, d]));

        for (const { docId, doc } of updates) {
          if (doc) {
            docMap.set(docId, doc);
          } else {
            docMap.delete(docId);
          }
        }

        return Array.from(docMap.values());
      });

      return syncResult;
    },
    [synchronize, reconstructSyncedDocument]
  );

  const syncDocuments = useCallback((): Promise<SyncResult> => {
    appendActivity({ type: "SYNC_STARTED" });
    const promise = sync();
    void promise.then(
      (result) => appendActivity({ type: "SYNC_COMPLETED", metadata: { accepted: result.acceptedOperations.length, sent: result.missingOperations.length } }),
      (error: unknown) => appendActivity({ type: "SYNC_FAILED", metadata: { message: error instanceof Error ? error.message : String(error) } }),
    );
    return promise;
  }, [appendActivity, sync]);

  const previousOnlineState = useRef(isOnline);
  const pendingOnlineSync = useRef(false);
  const authRefreshRequested = useRef(false);
  useEffect(() => {
    const recoveredConnection = previousOnlineState.current === false && isOnline === true;
    previousOnlineState.current = isOnline;

    if (!isOnline) {
      pendingOnlineSync.current = false;
      authRefreshRequested.current = false;
      return;
    }

    if (recoveredConnection) {
      pendingOnlineSync.current = true;
      authRefreshRequested.current = false;
    }

    // The online event can arrive while AuthProvider is still validating or
    // refreshing the session. Keep the recovery request pending until that
    // state is settled; this avoids sending /sync before the session cookie is
    // available.
    if (!pendingOnlineSync.current || isAuthLoading || isRefreshingAuth) {
      return;
    }

    if (auth?.refreshUser && !authRefreshRequested.current) {
      authRefreshRequested.current = true;
      setIsRefreshingAuth(true);
      void auth.refreshUser().finally(() => setIsRefreshingAuth(false));
      return;
    }

    if (!isAuthenticated) {
      return;
    }

    pendingOnlineSync.current = false;
    void Promise.resolve().then(() => syncDocuments()).catch(() => {
      // The existing sync activity/state records the failure; pending
      // operations remain available for a later manual or online transition.
    });
  }, [auth, isOnline, isAuthLoading, isAuthenticated, isRefreshingAuth, syncDocuments]);

  const getSyncStatus = useCallback((): SyncStatus => {
    return getCoordinatorSyncStatus();
  }, [getCoordinatorSyncStatus]);

  const isSyncing = useCallback((): boolean => {
    return isCoordinatorSyncing();
  }, [isCoordinatorSyncing]);

  const getLastSyncResult = useCallback((): SyncResult | null => {
    return getCoordinatorLastSyncResult();
  }, [getCoordinatorLastSyncResult]);

  const getLastSyncError = useCallback((): Error | null => {
    return getCoordinatorLastSyncError();
  }, [getCoordinatorLastSyncError]);

  const getLastSuccessfulSyncAt = useCallback((): number | null => {
    return getCoordinatorLastSuccessfulSyncAt();
  }, [getCoordinatorLastSuccessfulSyncAt]);

  const syncState = deriveSyncState({
    isOnline,
    syncStatus: getCoordinatorSyncStatus(),
    hasPendingOperations: hasPendingOperations(),
  });

  const value = useMemo(
    () => ({
      documents,
      isLoading,
      isOnline,
      syncState,
      createDocument,
      getDocument,
      getPendingOperationsForDocument,
      activity,
      updateDocument,
      toggleFavorite,
      deleteDocument,
      syncDocuments,
      getSyncStatus,
      isSyncing,
      getLastSyncResult,
      getLastSyncError,
      getLastSuccessfulSyncAt,
      synchronizeDocument,
      synchronizeAll,
    }),
    [
      documents,
      isLoading,
      isOnline,
      syncState,
      createDocument,
      getDocument,
      updateDocument,
      toggleFavorite,
      deleteDocument,
      syncDocuments,
      getSyncStatus,
      isSyncing,
      getLastSyncResult,
      getLastSyncError,
      getLastSuccessfulSyncAt,
      synchronizeDocument,
      synchronizeAll,
      getPendingOperationsForDocument,
      activity,
    ]
  );

  return <DocumentsContext.Provider value={value}>{children}</DocumentsContext.Provider>;
};