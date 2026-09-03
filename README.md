<h1 align="center">
  <br/>
  <img src="frontend/public/synclab-logo.svg" alt="Synclab" width="200"/>
  <br/>
  <br/>
  Synclab
  <br/>
</h1>

<p align="center">
  <strong>Offline-first document editor built around local persistence,<br/>operation-based synchronization, and conflict-free replicated data structures.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-5.x%20%7C%206.x-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/Fastify-5-000000?style=flat-square&logo=fastify&logoColor=white" alt="Fastify"/>
  <img src="https://img.shields.io/badge/PostgreSQL-pg%208-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite"/>
  <img src="https://img.shields.io/badge/Vitest-937%20tests-6E9F18?style=flat-square&logo=vitest&logoColor=white" alt="Tests"/>
  <img src="https://img.shields.io/badge/Vercel-deployed-000000?style=flat-square&logo=vercel&logoColor=white" alt="Vercel"/>
  <img src="https://img.shields.io/badge/Render-deployed-46E3B7?style=flat-square&logo=render&logoColor=white" alt="Render"/>
</p>

<p align="center">
  <a href="https://synclab-pi.vercel.app" target="_blank"><strong>🌐 Try it live →</strong></a>
</p>

---

## ✨ Overview

Synclab is a document editor built for environments where connectivity cannot be assumed. Every edit happens locally first — no network roundtrip, no spinners, no blocking. When connectivity is restored, an operation-based synchronization engine identifies exactly what changed, exchanges only the delta, and merges it through Vector Clocks and a custom CRDT layer.

The architectural bet is that **local state is canonical**. The server is a synchronization peer, not an authority. Documents are stored in IndexedDB in the browser, and every mutation is recorded as an immutable operation with a causal timestamp. This makes the system naturally tolerant to network failures, concurrent edits across devices, and out-of-order delivery.

---

## 🚀 Features

### Editor

- Create, edit, and delete documents locally
- Debounced auto-save — writes persist to IndexedDB 300 ms after typing stops
- Split edit / preview modes for Markdown rendering
- Custom Markdown parser with support for headings (H1–H3), code blocks (with language hints), bold, italic, inline code, and links
- Favorite documents for quick access
- Per-document pending operation count visible in the editor header

### Offline-first

- All edits are written to **IndexedDB** before any network call is attempted
- A **Service Worker** (custom, no Workbox) pre-caches the entire app shell at build time and serves it offline
- The browser persists the authenticated user profile in `localStorage`, allowing the app to render the UI and open documents without a server session
- Device identity is stable across page refreshes (`localStorage` UUID), enabling correct Vector Clock attribution per machine

### Synchronization

- **Operation-based sync** — every CREATE, UPDATE\_TITLE, UPDATE\_CONTENT, and DELETE is a named operation with an ID, device ID, timestamp, and Vector Clock
- **Vector Clock** (`VectorClock`) is immutable (frozen), correctly computes `BEFORE / AFTER / EQUAL / CONCURRENT` using pointwise comparison, and supports causal merge
- **Deterministic ordering** — concurrent operations from different devices are sorted by `(deviceId, id)` tiebreaker, ensuring every replica arrives at the same order
- **Idempotent deduplication** — the `OperationLog` tracks a `Set<id>` and silently drops already-seen operations
- **Snapshot compaction** — after every 10 accepted operations, the `OperationManager` creates a snapshot of the materialized document state, allowing historical operations to be dropped from IndexedDB
- **Bidirectional sync** via a single `POST /sync` — the client sends local operations and snapshots, the server responds with `acceptedOperations` and `missingOperations`
- The `SyncCoordinator` prevents concurrent in-flight sync calls — subsequent calls while one is pending attach to the existing promise
- Last successful sync timestamp is persisted in `localStorage` across sessions

### Backend CRDT

- **`TextDocumentCrdt`** in the backend models rich-text content as a sequence of character-level elements with stable IDs
- Operations are `INSERT` (with `afterId` and `content`) and `DELETE` (with `elementIds`) — a classic sequence CRDT structure
- **Tombstone semantics** — deleted elements remain in the internal sequence but are filtered out when materializing state, preserving causal consistency across replicas
- **`SyncEngine`** (backend) uses a Union-Find with path compression and union-by-rank to group causally related operations, then emits a deterministic topological order

### User Experience

- **Command Palette** (`⌘K` / `Ctrl+K`) — fuzzy-search navigation to any command (new document, sync, settings, help, activity log, markdown reference, and per-document navigation)
- **Dark / Light / System theme** — persisted in `localStorage`, respects `prefers-color-scheme` media query in System mode
- **Sync Center** — dedicated page showing sync status (synced / pending / syncing / error / offline), pending operation count per document, activity log, and last sync timestamp
- **Activity log** — all document events (created, updated) and sync events (started, completed, failed) are recorded in IndexedDB
- **Historical document restoration** — browse the state of any document at any past operation
- **Help Center** — in-app documentation covering getting started, creating documents, offline-first, CRDT, sync, keyboard shortcuts, command palette, and Markdown
- Responsive layout — works across screen sizes

### Authentication

- Email + password registration and login (argon2id password hashing)
- Google OAuth 2.0 (optional, configured via env vars)
- Session-based auth via HTTP-only cookies
- `ProtectedRoute` component guards all `/app/*` routes on the frontend
- Offline-resilient: the frontend falls back to cached user profile when the auth server is unreachable, and re-validates when connectivity returns

---

## 🧠 How It Works

### Architecture overview

```mermaid
flowchart TD
    User([User])
    UI[React Application]
    IDB[(IndexedDB)]
    OM[OperationManager]
    OL[OperationLog]
    VC[VectorClock]
    SC[SyncCoordinator]
    SW[Service Worker]
    HTTP[HttpSyncTransport]
    API[Fastify HTTP API]
    DS[DocumentSyncService]
    CRDT[TextDocumentCrdt]
    PG[(PostgreSQL)]

    User -->|"edits"| UI
    UI -->|"createOperation"| OM
    OM -->|"append + dedup"| OL
    OM -->|"increment"| VC
    OM -->|"putOperation"| IDB
    IDB -->|"offline serving"| SW
    SC -->|"sync()"| HTTP
    HTTP -->|"POST /sync"| API
    API --> DS
    DS -->|"INSERT / DELETE"| CRDT
    DS -->|"store"| PG
    API -->|"missingOperations"| HTTP
    HTTP -->|"mergeOperations"| OM
    OM -->|"reconstruct"| UI
```

### Sync flow, step by step

1. **User types** → `handleContentChange` fires, debounced 300 ms
2. **`OperationManager.createOperation`** is called with type `UPDATE_CONTENT`
3. The VectorClock is incremented for the local `deviceId`
4. The operation receives a UUID, the current ISO timestamp, and the new Vector Clock
5. The operation is appended to the `OperationLog` (deduplication check by ID)
6. The operation is persisted to **IndexedDB** via `putOperation`
7. The document state is immediately derived by reducing all ordered operations — the UI updates without any network call
8. When `SyncCoordinator.sync()` fires, `HttpSyncTransport.sync()` sends a `POST /sync` with all local operations and snapshots
9. The backend's `DocumentSyncService` processes the payload, persists new operations, and identifies `missingOperations` (operations the client doesn't know about)
10. The response arrives and `OperationManager` merges `missingOperations` into the local log, updates the Vector Clock, and reconstructs the document state
11. If `pendingOperationIds` are now acknowledged, they are removed from the pending set

### Conflict resolution

Synclab does not implement real-time collaborative editing with shared cursors or presence. Each session operates independently. When two devices make concurrent edits to the same document (no causal relationship between their Vector Clocks), the ordering tiebreaker `(deviceId lexicographic, operation UUID lexicographic)` ensures that every replica deterministically arrives at the same document state. The "last operation wins" semantic applies at the document level for `UPDATE_CONTENT` — the CRDT layer (`TextDocumentCrdt`) provides stable character-level identities for richer merge scenarios.

---

## 🔄 Offline-first & Synchronization

### Local persistence

Every document and every operation is stored in **IndexedDB** (database: `synclab_store`, version 5) with five object stores:

| Store | Key | Purpose |
|---|---|---|
| `documents` | `id` | Materialized document snapshots |
| `operations` | `id` | Full immutable operation log |
| `snapshots` | `documentId` | Compacted snapshots (per document) |
| `activity` | `id` | Recent activity events |
| `historicalActivity` | `operationId` | Per-operation historical records |

### Operation types

```typescript
type OperationType =
  | "CREATE_DOCUMENT"
  | "UPDATE_TITLE"
  | "UPDATE_CONTENT"
  | "DELETE_DOCUMENT";
```

Each operation carries:

```typescript
interface Operation {
  id: string;           // UUID — stable identifier, used for deduplication
  documentId: string;
  deviceId: string;     // Stable UUID from localStorage, identifies this browser
  type: OperationType;
  payload: OperationPayload;
  timestamp: string;    // ISO 8601
  vectorClock: VectorClock;
}
```

### Vector Clocks

The `VectorClock` class is immutable — every `increment` and `merge` returns a new instance. Causal comparison follows the standard pointwise rules:

- **BEFORE** (`A → B`): every counter of A ≤ B, at least one strictly less
- **AFTER** (`B → A`): every counter of A ≥ B, at least one strictly greater
- **EQUAL**: all counters identical
- **CONCURRENT**: neither dominates — parallel edits from different devices

### Snapshot compaction

After every 10 operations accepted from a sync response, the `OperationManager` creates a `DocumentSnapshot` containing the current materialized document and the current Vector Clock. Operations older than the snapshot can be purged from IndexedDB. On startup, if no operations are found, Vector Clock state is recovered from the latest snapshots.

### Sync endpoint

```
POST /sync
```

Request:

```jsonc
{
  "deviceId": "a1b2c3d4...",
  "operations": [
    {
      "id": "uuid",
      "documentId": "doc-uuid",
      "deviceId": "a1b2c3d4...",
      "type": "UPDATE_CONTENT",
      "payload": { "type": "UPDATE_CONTENT", "content": "..." },
      "timestamp": "2026-09-03T01:00:00.000Z",
      "vectorClock": { "a1b2c3d4...": 5 }
    }
  ],
  "snapshots": []
}
```

Response:

```jsonc
{
  "acceptedOperations": [...],   // newly stored on server
  "missingOperations": [...],    // server has, client doesn't
  "snapshots": [...]
}
```

---

## 🏗️ Architecture

### Layers

```mermaid
flowchart TB
    subgraph Frontend
        direction TB
        Router[React Router]
        Pages[Pages]
        Components[Components]
        Ctx[Context / Hooks]
        Lib["lib/ — sync primitives"]
        IDB[(IndexedDB)]
        LS[(localStorage)]
        SW2[Service Worker]
    end

    subgraph Backend
        direction TB
        Transport[Transport — Fastify HTTP]
        AppLayer["Application — SyncService / AuthService"]
        Domain["Domain — SyncEngine / CRDT / VectorClock"]
        Infra[Infrastructure — Postgres / SQLite / InMemory]
        DB[(PostgreSQL)]
    end

    Frontend -->|"POST /sync\nGET /auth/me\nPOST /auth/login"| Backend
    Infra --> DB
```

### Frontend structure

```
frontend/src/
├── components/
│   ├── app/          # Editor, navigation, Markdown preview, sidebar
│   ├── auth/         # Login/register forms
│   └── dashboard/    # Dashboard, activity panel, mobile topbar
├── context/          # AuthContext, DocumentsContext, OperationManagerContext, ThemeContext, CommandPaletteContext
├── hooks/            # useDocuments, useOperationManager, useConnectivity
├── lib/              # All synchronization primitives (see below)
├── pages/            # One file per route
├── router.tsx        # React Router v7 configuration
└── types/            # Shared TypeScript interfaces
```

Key modules in `lib/`:

| Module | Role |
|---|---|
| `vectorClock.ts` | Immutable Vector Clock with causal comparison |
| `operationLog.ts` | Append-only log with Set-based deduplication |
| `operationFactory.ts` | Creates stamped operations (UUID + timestamp + VectorClock) |
| `operationOrdering.ts` | Deterministic sort: causal order + `(deviceId, id)` tiebreaker |
| `documentReducer.ts` | Folds operations into materialized document state |
| `documentStateEngine.ts` | Orchestrates ordering + reduction |
| `documentSnapshot.ts` | Creates compacted snapshots from materialized state |
| `compactPersistedOperations.ts` | Identifies and removes operations covered by a snapshot |
| `documentHistory.ts` | Reconstructs document at any historical operation |
| `syncEngine.ts` | High-level merge: identifies `toRemote` / `toLocal` deltas |
| `syncCoordinator.ts` | Single-flight sync orchestration, status tracking |
| `httpSyncTransport.ts` | HTTP client for `POST /sync` |
| `indexedDb.ts` | All IndexedDB read/write operations |
| `deviceIdentity.ts` | Stable browser device UUID |
| `offlineAuthStorage.ts` | Cached auth user in localStorage |

### Backend structure

```
backend/src/
├── domain/
│   ├── crdt/                  # TextDocumentCrdt — character-level sequence CRDT
│   ├── document-operations/   # DocumentOperation types and repositories
│   ├── operations/            # Operation, OperationLog, OperationSerializer
│   ├── sync/                  # SyncEngine — deterministic ordering + Union-Find
│   └── vector-clock/          # VectorClock domain type
├── application/
│   ├── auth/                  # PasswordAuthService, GoogleOAuthService, SessionService, ApiKeyValidator
│   └── sync/                  # SyncService, DocumentSyncService, DocumentOperationAdapter
├── infrastructure/
│   ├── auth/                  # Postgres auth repositories
│   └── persistence/
│       ├── postgres/          # PostgresOperationRepository, PostgresDocumentOperationRepository
│       ├── sqlite/            # SqliteOperationRepository (used in tests)
│       ├── document-operations/ # In-memory + Postgres + SQLite implementations
│       └── migrations/        # Database migration runner
└── transport/http/
    ├── server.ts              # Fastify app factory + dependency wiring
    ├── routes.ts              # POST /sync, GET /sync/pull, POST /sync/push
    └── authRoutes.ts          # POST /auth/register, /login, /logout, GET /auth/me, /auth/google
```

---

## 🛠️ Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| TypeScript | ~6.0 | Static typing |
| React | 19 | UI framework |
| React Router | 7 | Client-side routing |
| Tailwind CSS | 4 | Utility-first styling |
| Vite | 8 | Build tool and dev server |
| Vitest | 4 | Unit and integration testing |
| @testing-library/react | 16 | Component testing |
| IndexedDB (native) | — | Local operation and document persistence |
| Service Worker (custom) | — | App shell caching and offline support |
| localStorage (native) | — | Device ID, auth cache, theme preference, sync metadata |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| TypeScript | ~5.7 | Static typing |
| Fastify | 5 | HTTP framework |
| @fastify/cors | 11 | Cross-origin resource sharing |
| @fastify/cookie | 11 | HttpOnly cookie support |
| @fastify/rate-limit | 11 | Per-identity rate limiting on sync endpoints |
| argon2 | 0.45 | Password hashing (argon2id) |
| google-auth-library | 11 | Google OAuth 2.0 token verification |
| pg | 8 | PostgreSQL client |
| sql.js | 1.8 | SQLite via WASM — used in test environment |
| Vitest | 3 | Unit and integration testing |

### Infrastructure

| Layer | Technology |
|---|---|
| Frontend hosting | Vercel |
| Backend hosting | Render |
| Database | PostgreSQL |
| Local storage (browser) | IndexedDB |
| Test backend storage | SQLite via sql.js (WASM) |

---

## 📁 Project Structure

```
synclab/
├── frontend/
│   ├── public/
│   │   ├── sw.js               # Service Worker (custom, no Workbox)
│   │   ├── synclab-logo.svg
│   │   └── synclab-mark.svg
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── context/            # React contexts (Auth, Documents, OperationManager, Theme, CommandPalette)
│   │   ├── hooks/              # Custom React hooks
│   │   ├── lib/                # Synchronization primitives and persistence
│   │   ├── pages/              # Route-level page components
│   │   ├── types/              # Shared TypeScript types
│   │   ├── router.tsx          # Application router
│   │   ├── App.tsx             # Root component
│   │   └── main.tsx            # Entry point
│   ├── tests/                  # 51 test files · 937 tests
│   ├── vite.config.ts          # Vite + Service Worker manifest injection plugin
│   ├── vitest.config.ts
│   └── vercel.json             # Vercel rewrites (auth + sync proxy to Render)
│
├── backend/
│   ├── src/
│   │   ├── domain/             # Pure business logic (no framework dependencies)
│   │   ├── application/        # Use cases: SyncService, DocumentSyncService, AuthService
│   │   ├── infrastructure/     # Concrete adapters: Postgres, SQLite, InMemory
│   │   └── transport/http/     # Fastify routes and server factory
│   └── tests/                  # 26 test files · 700+ tests
│
└── README.md
```

---

## 🔐 Authentication & Security

### Auth flow

1. User registers or logs in via `POST /auth/register` or `POST /auth/login`
2. Server creates a session token and sets an **HttpOnly cookie** (`synclab_session`) — the token never touches JavaScript
3. All subsequent requests from the same browser automatically include the cookie
4. `GET /auth/me` validates the session and returns the user profile
5. `POST /auth/logout` revokes the session server-side and clears the cookie

### Google OAuth

Google OAuth 2.0 is supported optionally. When `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are configured, `/auth/google` redirects to Google's authorization page and `/auth/google/callback` exchanges the code for a token and creates a session.

### Route protection

- The frontend's `ProtectedRoute` component checks `isAuthenticated` before rendering any `/app/*` route
- If the auth server is unreachable, the cached user profile from `localStorage` is used optimistically; a background revalidation runs and clears the cache on 401
- The sync endpoint (`POST /sync`) is authenticated via the session cookie when called from the browser

### Rate limiting

All sync routes are rate-limited using `@fastify/rate-limit`. The key is `clientId:deviceId` (per user per device), and standard rate limit headers (`X-RateLimit-*`, `Retry-After`) are included in responses.

### Passwords

Passwords are hashed with **argon2id** via the `argon2` library. Plaintext passwords are never stored or logged.

---

## 🧪 Testing

### Frontend — 51 test files · 937 tests

```bash
cd frontend
npm test
```

| Area | Files |
|---|---|
| Vector Clock — all causal orderings | `vectorClock.test.ts` |
| Operation Log — deduplication, ordering | `operationLog.test.ts`, `operationOrdering.test.ts` |
| Document Reducer — CREATE / UPDATE / DELETE | `documentReducer.test.ts` |
| State Engine — full operation replay | `documentStateEngine.test.ts` |
| Sync Engine — delta computation, merge | `syncEngine.test.ts` |
| Sync Coordinator — single-flight, status | `syncCoordinator.test.ts` |
| HTTP Sync Transport | `httpSyncTransport.test.ts` |
| Operation Manager — full lifecycle + recovery | `operationManager.test.ts`, `operationManager.recovery.test.ts` |
| Snapshot compaction | `snapshotCompaction.reconstruction.test.ts`, `compactPersistedOperations.test.ts` |
| Historical document restoration | `documentHistory.test.ts`, `historicalVersionIntegration.test.ts` |
| Two-device sync convergence | `syncTwoDevices.test.ts` |
| Authentication flows | `authentication.test.tsx`, `google-oauth.test.tsx` |
| Concurrency and failure recovery | `part80Concurrency.test.ts`, `part82SyncFailureRecovery.test.ts` |
| UI pages and components | `dashboardSyncAction.test.tsx`, `activityDetailsPage.test.tsx`, `favoritesPage.test.tsx`, ... |

### Backend — 26 test files

```bash
cd backend
npm test
```

| Area | Files |
|---|---|
| Vector Clock | `vector-clock.test.ts` |
| TextDocumentCrdt — sequence CRDT | `text-document-crdt.test.ts` |
| SyncService and DocumentSyncService | `syncService.test.ts`, `sync-service.test.ts` |
| HTTP sync endpoints (full Fastify server) | `http-sync.test.ts` |
| Document operation adapter | `documentOperationAdapter.test.ts` |
| Postgres repositories | `postgres-repository.test.ts`, `documentOperationRepository.test.ts` |
| Snapshot repository | `documentSnapshotRepository.test.ts` |
| Password auth | `password-auth.test.ts` |
| Session service | `session-service.test.ts` |
| Google OAuth | `google-oauth.test.ts` |

> **Note:** integration tests that start an HTTP server on port 3456 (e.g., `sync-client.test.ts`) will fail if that port is already in use in the test environment.

---

## 💻 Getting Started

### Requirements

- Node.js 20+
- npm 10+
- PostgreSQL 15+ (optional — the backend uses in-memory storage when `DATABASE_URL` is not set)

### Clone

```bash
git clone https://github.com/QueirozMoura/synclab.git
cd synclab
```

### Install

```bash
cd frontend && npm install
cd ../backend && npm install
```

### Environment Variables

```bash
cp backend/.env.example backend/.env
```

```env
# HTTP server
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info

# PostgreSQL (optional)
DATABASE_URL=postgresql://user:password@localhost:5432/synclab

# Session
SESSION_COOKIE_NAME=synclab_session
SESSION_TTL_SECONDS=2592000

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
APP_BASE_URL=http://localhost:5173
```

For the frontend (development only):

```env
# frontend/.env.local — defaults to http://localhost:3000 when omitted
VITE_AUTH_API_BASE_URL=http://localhost:3000
```

### Database migration (PostgreSQL only)

```bash
cd backend && npm run migrate
```

### Run

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Frontend available at `http://localhost:5173`.

### Build

```bash
# Frontend
cd frontend && npm run build

# Backend
cd backend && npm run build && npm start
```

---

## 🌐 Deployment

```
User
 │
 ▼
Vercel  (frontend — CDN + edge rewrites)
 │  rewrites /auth/* and /sync → Render
 ▼
Render  (backend — Node.js)
 │
 ▼
PostgreSQL  (managed database)
```

The `frontend/vercel.json` configures transparent proxying so the frontend makes same-origin requests (avoiding cross-origin cookie issues):

```json
{
  "rewrites": [
    { "source": "/auth/:path*", "destination": "https://synclab-sali.onrender.com/auth/:path*" },
    { "source": "/sync",        "destination": "https://synclab-sali.onrender.com/sync" },
    { "source": "/(.*)",        "destination": "/index.html" }
  ]
}
```

---

## 📚 Help Center

Built-in documentation at `/app/help`:

| Route | Topic |
|---|---|
| `/app/help/getting-started` | Quick start guide |
| `/app/help/creating-documents` | Creating and organizing documents |
| `/app/help/collaboration` | Collaboration |
| `/app/help/offline-first` | How offline editing works |
| `/app/help/crdt` | CRDT technology |
| `/app/help/sync` | Synchronization internals |
| `/app/help/keyboard-shortcuts` | Full keyboard shortcut reference |
| `/app/help/command-palette` | Command Palette (`⌘K` / `Ctrl+K`) |
| `/app/help/markdown` | Supported Markdown syntax |

---

## 🧩 Engineering Decisions

### Why offline-first?

Network availability is an ambient assumption that breaks constantly — mobile data drops, corporate proxies, airplane mode, flaky Wi-Fi. An offline-first design treats connectivity as an optimization rather than a requirement. The cost is complexity in the sync layer; the benefit is that the user experience never degrades based on infrastructure.

### Why operation-based synchronization?

State-based sync (sending full document snapshots) is simple but expensive. Operation-based sync sends only what changed since the last sync — bounded by the number of mutations, not the document size. It also preserves a natural audit trail and enables historical reconstruction of any document state.

### Why Vector Clocks?

Timestamps from different machines cannot be compared reliably (clock drift, NTP skew). Vector Clocks encode causality directly: if operation A is in B's Vector Clock, A happened-before B, regardless of wall time. This lets the system correctly order operations from different devices without a central sequencer.

### Why a deterministic ordering tiebreaker?

When two operations are concurrent (neither happened-before the other), the system still needs to produce a consistent order across all replicas. Sorting by `(deviceId, operationId)` — both stable, globally unique strings — guarantees that every client, independently, arrives at the same operation sequence. This is the key property that enables eventual consistency without coordination.

### Why snapshot compaction?

An append-only operation log grows unbounded. After N operations, the materialized state can be captured in a snapshot and the underlying operations dropped. On the next sync, only the snapshot (and any post-snapshot operations) need to be exchanged. The threshold of 10 operations is conservative and can be tuned.

### Why separate document-level and character-level CRDTs?

Document operations (`CREATE_DOCUMENT`, `UPDATE_TITLE`, `UPDATE_CONTENT`, `DELETE_DOCUMENT`) express intent at a semantic level. The `TextDocumentCrdt` operates at the character level, assigning stable IDs to each element and using tombstones to handle concurrent deletions correctly. This separation keeps the sync protocol lightweight while the CRDT handles fine-grained conflict resolution when needed.

---

## ⚠️ Current Limitations

- **No real-time collaboration.** Synclab does not implement WebSocket connections, presence indicators, shared cursors, or live selection visibility. Each session operates independently and converges through the periodic sync endpoint.
- **No conflict resolution UI.** When concurrent edits produce different `UPDATE_CONTENT` operations, the deterministic ordering tiebreaker determines which content is applied last. There is no UI to review or merge conflicting content.
- **Single-user documents.** The authorization model grants document access per user. Document sharing across accounts is not implemented.
- **No push from server.** The backend does not push new operations to connected clients. Sync is client-initiated.

---

## 🗺️ Future Directions

These are ideas, not commitments:

- WebSocket transport for lower-latency sync
- Presence and awareness layer (cursors, online indicators) built on the existing Vector Clock infrastructure
- Conflict review UI for concurrent `UPDATE_CONTENT` operations
- Document sharing and access control lists
- Mobile application (React Native)

---

## 👨‍💻 Author

**Gustavo Queiroz Moura**  
[github.com/QueirozMoura](https://github.com/QueirozMoura)

---

<p align="center">
  <a href="https://synclab-pi.vercel.app">Live app</a> ·
  <a href="https://github.com/QueirozMoura/synclab/issues">Report an issue</a>
</p>

