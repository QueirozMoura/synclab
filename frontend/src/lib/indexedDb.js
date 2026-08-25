import { VectorClock } from "./vectorClock";
const DB_NAME = "synclab_store";
const DOCUMENTS_STORE = "documents";
const OPERATIONS_STORE = "operations";
const SNAPSHOTS_STORE = "snapshots";
const ACTIVITY_STORE = "activity";
const HISTORICAL_ACTIVITY_STORE = "historicalActivity";
const DB_VERSION = 5;
let dbPromise = null;
function openDatabase() {
    if (dbPromise) {
        return dbPromise;
    }
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => {
            dbPromise = null;
            reject(new Error("Failed to open IndexedDB"));
        };
        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(DOCUMENTS_STORE)) {
                database.createObjectStore(DOCUMENTS_STORE, { keyPath: "id" });
            }
            if (!database.objectStoreNames.contains(OPERATIONS_STORE)) {
                database.createObjectStore(OPERATIONS_STORE, { keyPath: "id" });
            }
            if (!database.objectStoreNames.contains(SNAPSHOTS_STORE)) {
                database.createObjectStore(SNAPSHOTS_STORE, { keyPath: "documentId" });
            }
            if (!database.objectStoreNames.contains(ACTIVITY_STORE)) {
                database.createObjectStore(ACTIVITY_STORE, { keyPath: "id" });
            }
            if (!database.objectStoreNames.contains(HISTORICAL_ACTIVITY_STORE)) {
                database.createObjectStore(HISTORICAL_ACTIVITY_STORE, { keyPath: "operationId" });
            }
        };
    });
    return dbPromise;
}
export async function recordActivity(event) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(ACTIVITY_STORE, "readwrite");
        const request = transaction.objectStore(ACTIVITY_STORE).put(event);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error("Failed to persist activity"));
    });
}
export async function getRecentActivity(limit = 100) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const request = database.transaction(ACTIVITY_STORE, "readonly").objectStore(ACTIVITY_STORE).getAll();
        request.onsuccess = () => resolve(request.result.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, limit));
        request.onerror = () => reject(new Error("Failed to load activity"));
    });
}
export async function pruneActivity(limit = 100) {
    const events = await getRecentActivity(limit + 1);
    if (events.length <= limit)
        return;
    const database = await openDatabase();
    const transaction = database.transaction(ACTIVITY_STORE, "readwrite");
    for (const event of events.slice(limit))
        transaction.objectStore(ACTIVITY_STORE).delete(event.id);
}
export async function putHistoricalActivityRecord(record) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(HISTORICAL_ACTIVITY_STORE, "readwrite");
        const request = transaction.objectStore(HISTORICAL_ACTIVITY_STORE).put({
            ...record,
            operation: { ...record.operation, payload: { ...record.operation.payload }, vectorClock: record.operation.vectorClock instanceof VectorClock ? record.operation.vectorClock.toMap() : { ...record.operation.vectorClock } },
            before: record.before ? { ...record.before } : null,
            after: record.after ? { ...record.after } : null,
            vectorClock: { ...record.vectorClock },
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error("Failed to persist historical activity record"));
    });
}
export async function getHistoricalActivityRecord(operationId) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const request = database.transaction(HISTORICAL_ACTIVITY_STORE, "readonly").objectStore(HISTORICAL_ACTIVITY_STORE).get(operationId);
        request.onsuccess = () => {
            const record = request.result;
            resolve(record ? cloneHistoricalActivityRecord(record) : undefined);
        };
        request.onerror = () => reject(new Error("Failed to get historical activity record"));
    });
}
export async function deleteHistoricalActivityRecord(operationId) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const request = database.transaction(HISTORICAL_ACTIVITY_STORE, "readwrite").objectStore(HISTORICAL_ACTIVITY_STORE).delete(operationId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error("Failed to delete historical activity record"));
    });
}
function cloneHistoricalActivityRecord(record) {
    const serializedVectorClock = record.operation.vectorClock;
    const operationVectorClock = record.operation.vectorClock instanceof VectorClock
        ? record.operation.vectorClock.toMap()
        : typeof serializedVectorClock === "object" &&
            "clock" in serializedVectorClock &&
            typeof serializedVectorClock.clock === "object"
            ? serializedVectorClock.clock
            : serializedVectorClock;
    return {
        ...record,
        operation: {
            ...record.operation,
            payload: { ...record.operation.payload },
            vectorClock: VectorClock.from(operationVectorClock),
        },
        before: record.before ? { ...record.before } : null,
        after: record.after ? { ...record.after } : null,
        vectorClock: { ...record.vectorClock },
    };
}
export async function getAllDocuments() {
    console.log("[IndexedDB] getAllDocuments called");
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(DOCUMENTS_STORE, "readonly");
        const store = transaction.objectStore(DOCUMENTS_STORE);
        const request = store.getAll();
        request.onsuccess = () => {
            const docs = request.result;
            console.log("[IndexedDB] getAllDocuments result:", docs.length, "documents");
            docs.forEach(d => console.log("[IndexedDB]   - ", d.id, d.title, d.content?.length, "chars", d.updatedAt));
            resolve(docs);
        };
        request.onerror = () => {
            console.error("[IndexedDB] getAllDocuments error:", request.error);
            reject(new Error("Failed to get all documents"));
        };
    });
}
export async function getDocument(id) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(DOCUMENTS_STORE, "readonly");
        const store = transaction.objectStore(DOCUMENTS_STORE);
        const request = store.get(id);
        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = () => {
            reject(new Error("Failed to get document"));
        };
    });
}
export async function putDocument(document) {
    console.log("[IndexedDB] putDocument called:", { id: document.id, title: document.title, contentLength: document.content.length });
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(DOCUMENTS_STORE, "readwrite");
        const store = transaction.objectStore(DOCUMENTS_STORE);
        const request = store.put(document);
        request.onsuccess = () => {
            console.log("[IndexedDB] putDocument success:", document.id);
            resolve();
        };
        request.onerror = () => {
            console.error("[IndexedDB] putDocument error:", request.error);
            reject(new Error("Failed to put document"));
        };
    });
}
export async function deleteDocument(id) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(DOCUMENTS_STORE, "readwrite");
        const store = transaction.objectStore(DOCUMENTS_STORE);
        const request = store.delete(id);
        request.onsuccess = () => {
            resolve();
        };
        request.onerror = () => {
            reject(new Error("Failed to delete document"));
        };
    });
}
export async function getAllOperations() {
    console.log("[IndexedDB] getAllOperations called");
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(OPERATIONS_STORE, "readonly");
        const store = transaction.objectStore(OPERATIONS_STORE);
        const request = store.getAll();
        request.onsuccess = () => {
            const ops = request.result;
            console.log("[IndexedDB] getAllOperations result:", ops.length, "operations");
            resolve(ops);
        };
        request.onerror = () => {
            console.error("[IndexedDB] getAllOperations error:", request.error);
            reject(new Error("Failed to get all operations"));
        };
    });
}
export async function putOperation(operation) {
    console.log("[IndexedDB] putOperation called:", { id: operation.id, documentId: operation.documentId, type: operation.type });
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(OPERATIONS_STORE, "readwrite");
        const store = transaction.objectStore(OPERATIONS_STORE);
        const request = store.put(operation);
        request.onsuccess = () => {
            console.log("[IndexedDB] putOperation success:", operation.id);
            resolve();
        };
        request.onerror = () => {
            console.error("[IndexedDB] putOperation error:", request.error);
            reject(new Error("Failed to put operation"));
        };
    });
}
export async function deleteOperation(id) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(OPERATIONS_STORE, "readwrite");
        const store = transaction.objectStore(OPERATIONS_STORE);
        const request = store.delete(id);
        request.onsuccess = () => {
            resolve();
        };
        request.onerror = () => {
            reject(new Error("Failed to delete operation"));
        };
    });
}
export async function deleteOperations(ids) {
    if (ids.length === 0) {
        return;
    }
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(OPERATIONS_STORE, "readwrite");
        const store = transaction.objectStore(OPERATIONS_STORE);
        let completed = 0;
        let hasError = false;
        for (const id of ids) {
            const request = store.delete(id);
            request.onsuccess = () => {
                completed++;
                if (completed === ids.length && !hasError) {
                    resolve();
                }
            };
            request.onerror = () => {
                if (!hasError) {
                    hasError = true;
                    reject(new Error("Failed to delete operations"));
                }
            };
        }
    });
}
export async function clearOperations() {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(OPERATIONS_STORE, "readwrite");
        const store = transaction.objectStore(OPERATIONS_STORE);
        const request = store.clear();
        request.onsuccess = () => {
            resolve();
        };
        request.onerror = () => {
            reject(new Error("Failed to clear operations"));
        };
    });
}
export async function getSnapshot(documentId) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(SNAPSHOTS_STORE, "readonly");
        const store = transaction.objectStore(SNAPSHOTS_STORE);
        const request = store.get(documentId);
        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = () => {
            reject(new Error("Failed to get snapshot"));
        };
    });
}
export async function putSnapshot(snapshot) {
    console.log("[IndexedDB] putSnapshot called:", { documentId: snapshot.documentId, operationCount: snapshot.operationCount });
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(SNAPSHOTS_STORE, "readwrite");
        const store = transaction.objectStore(SNAPSHOTS_STORE);
        const request = store.put(snapshot);
        request.onsuccess = () => {
            console.log("[IndexedDB] putSnapshot success:", snapshot.documentId);
            resolve();
        };
        request.onerror = () => {
            console.error("[IndexedDB] putSnapshot error:", request.error);
            reject(new Error("Failed to put snapshot"));
        };
    });
}
export async function deleteSnapshot(documentId) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(SNAPSHOTS_STORE, "readwrite");
        const store = transaction.objectStore(SNAPSHOTS_STORE);
        const request = store.delete(documentId);
        request.onsuccess = () => {
            resolve();
        };
        request.onerror = () => {
            reject(new Error("Failed to delete snapshot"));
        };
    });
}
export async function getAllSnapshots() {
    console.log("[IndexedDB] getAllSnapshots called");
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(SNAPSHOTS_STORE, "readonly");
        const store = transaction.objectStore(SNAPSHOTS_STORE);
        const request = store.getAll();
        request.onsuccess = () => {
            const snapshots = request.result;
            console.log("[IndexedDB] getAllSnapshots result:", snapshots.length, "snapshots");
            resolve(snapshots);
        };
        request.onerror = () => {
            console.error("[IndexedDB] getAllSnapshots error:", request.error);
            reject(new Error("Failed to get all snapshots"));
        };
    });
}
export async function clearSnapshots() {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(SNAPSHOTS_STORE, "readwrite");
        const store = transaction.objectStore(SNAPSHOTS_STORE);
        const request = store.clear();
        request.onsuccess = () => {
            resolve();
        };
        request.onerror = () => {
            reject(new Error("Failed to clear snapshots"));
        };
    });
}
