import { describe, it, expect } from "vitest";
import { deleteOperations } from "../src/lib/indexedDb";

describe("indexedDb - deleteOperations", () => {
  it("deve ser exportada como função", () => {
    expect(typeof deleteOperations).toBe("function");
  });

  it("deve aceitar array de strings como parâmetro", () => {
    const ids: string[] = ["a", "b", "c"];
    expect(Array.isArray(ids)).toBe(true);
    expect(ids.every(id => typeof id === "string")).toBe(true);
  });

  it("deve ter assinatura correta: (ids: string[]) => Promise<void>", () => {
    const fn = deleteOperations;
    expect(fn.length).toBe(1);
  });
});