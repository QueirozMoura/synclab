import { describe, expect, it } from "vitest";
import { deriveSyncState } from "../src/lib/syncState";

describe("deriveSyncState", () => {
  const derive = (
    overrides: Partial<Parameters<typeof deriveSyncState>[0]> = {},
  ) =>
    deriveSyncState({
      isOnline: true,
      syncStatus: "idle",
      hasPendingOperations: false,
      ...overrides,
    });

  it.each([
    [{}, "synced"],
    [{ hasPendingOperations: true }, "pending"],
    [{ syncStatus: "syncing", hasPendingOperations: true }, "syncing"],
    [{ syncStatus: "error" }, "error"],
    [{ isOnline: false }, "offline"],
    [
      { isOnline: false, hasPendingOperations: true, syncStatus: "error" },
      "offline",
    ],
    [{ syncStatus: "success" }, "synced"],
  ])("derives %s correctly", (input, expected) => {
    expect(derive(input)).toBe(expected);
  });
});
