import { vi } from "vitest";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!DOCTYPE html><html><body><div id='root'></div></body></html>", {
  url: "http://localhost",
  pretendToBeVisual: true,
  resources: "usable",
});

global.window = dom.window as unknown as Window & typeof globalThis;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.HTMLDivElement = dom.window.HTMLDivElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.Event = dom.window.Event;
global.CustomEvent = dom.window.CustomEvent;
global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = vi.fn((id) => clearTimeout(id));

Object.defineProperty(global, "crypto", {
  value: {
    randomUUID: () => {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },
    subtle: {
      digest: vi.fn(),
      sign: vi.fn(),
      verify: vi.fn(),
      generateKey: vi.fn(),
      importKey: vi.fn(),
      exportKey: vi.fn(),
    },
  },
  writable: true,
});

// Mock indexedDB
const mockIndexedDB = {
  open: vi.fn(() => {
    const request = {
      onerror: null,
      onsuccess: null,
      onupgradeneeded: null,
      result: {
        objectStoreNames: {
          contains: vi.fn(() => false),
        },
        createObjectStore: vi.fn(() => ({
          keyPath: "id",
        })),
        transaction: vi.fn(() => ({
          objectStore: vi.fn(() => ({
            getAll: vi.fn(() => ({ onsuccess: null, onerror: null, result: [] })),
            get: vi.fn(() => ({ onsuccess: null, onerror: null, result: undefined })),
            put: vi.fn(() => ({ onsuccess: null, onerror: null })),
            delete: vi.fn(() => ({ onsuccess: null, onerror: null })),
            clear: vi.fn(() => ({ onsuccess: null, onerror: null })),
          })),
        })),
      },
    };
    setTimeout(() => {
      if (request.onsuccess) request.onsuccess({ target: request.result });
    }, 0);
    return request;
  }),
};

global.indexedDB = mockIndexedDB as unknown as IDBFactory;
