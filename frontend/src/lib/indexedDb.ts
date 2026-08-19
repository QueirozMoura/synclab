import type { Document } from "../types/document";

const DB_NAME = "synclab_store";
const STORE_NAME = "documents";
const DB_VERSION = 1;

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
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });

  return dbPromise;
}

export async function getAllDocuments(): Promise<Document[]> {
  console.log("[IndexedDB] getAllDocuments called");
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
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
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
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
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
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
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error("Failed to delete document"));
    };
  });
}