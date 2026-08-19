import type { Document } from "../types/document";
import type { Operation } from "../types/operation";
import type { DocumentSnapshot } from "../types/documentSnapshot";

const DB_NAME = "synclab_store";
const DOCUMENTS_STORE = "documents";
const OPERATIONS_STORE = "operations";
const SNAPSHOTS_STORE = "snapshots";
const DB_VERSION = 3;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
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
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(DOCUMENTS_STORE)) {
        database.createObjectStore(DOCUMENTS_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(OPERATIONS_STORE)) {
        database.createObjectStore(OPERATIONS_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(SNAPSHOTS_STORE)) {
        database.createObjectStore(SNAPSHOTS_STORE, { keyPath: "documentId" });
      }
    };
  });

  return dbPromise;
}

export async function getAllDocuments(): Promise<Document[]> {
  console.log("[IndexedDB] getAllDocuments called");
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DOCUMENTS_STORE, "readonly");
    const store = transaction.objectStore(DOCUMENTS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const docs = request.result as Document[];
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

export async function getDocument(id: string): Promise<Document | undefined> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(DOCUMENTS_STORE, "readonly");
    const store = transaction.objectStore(DOCUMENTS_STORE);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result as Document | undefined);
    };

    request.onerror = () => {
      reject(new Error("Failed to get document"));
    };
  });
}

export async function putDocument(document: Document): Promise<void> {
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

export async function deleteDocument(id: string): Promise<void> {
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

export async function getAllOperations(): Promise<Operation[]> {
  console.log("[IndexedDB] getAllOperations called");
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(OPERATIONS_STORE, "readonly");
    const store = transaction.objectStore(OPERATIONS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const ops = request.result as Operation[];
      console.log("[IndexedDB] getAllOperations result:", ops.length, "operations");
      resolve(ops);
    };

    request.onerror = () => {
      console.error("[IndexedDB] getAllOperations error:", request.error);
      reject(new Error("Failed to get all operations"));
    };
  });
}

export async function putOperation(operation: Operation): Promise<void> {
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

export async function deleteOperation(id: string): Promise<void> {
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

export async function clearOperations(): Promise<void> {
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

export async function getSnapshot(documentId: string): Promise<DocumentSnapshot | undefined> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SNAPSHOTS_STORE, "readonly");
    const store = transaction.objectStore(SNAPSHOTS_STORE);
    const request = store.get(documentId);

    request.onsuccess = () => {
      resolve(request.result as DocumentSnapshot | undefined);
    };

    request.onerror = () => {
      reject(new Error("Failed to get snapshot"));
    };
  });
}

export async function putSnapshot(snapshot: DocumentSnapshot): Promise<void> {
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

export async function deleteSnapshot(documentId: string): Promise<void> {
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

export async function getAllSnapshots(): Promise<DocumentSnapshot[]> {
  console.log("[IndexedDB] getAllSnapshots called");
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SNAPSHOTS_STORE, "readonly");
    const store = transaction.objectStore(SNAPSHOTS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const snapshots = request.result as DocumentSnapshot[];
      console.log("[IndexedDB] getAllSnapshots result:", snapshots.length, "snapshots");
      resolve(snapshots);
    };

    request.onerror = () => {
      console.error("[IndexedDB] getAllSnapshots error:", request.error);
      reject(new Error("Failed to get all snapshots"));
    };
  });
}

export async function clearSnapshots(): Promise<void> {
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