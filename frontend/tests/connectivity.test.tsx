import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConnectivity } from "../src/hooks/useConnectivity";

describe("useConnectivity", () => {
  let onlineState = true;
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    onlineState = true;
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => onlineState,
    });
    addSpy = vi.spyOn(window, "addEventListener");
    removeSpy = vi.spyOn(window, "removeEventListener");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes from navigator.onLine", () => {
    onlineState = false;
    const { result } = renderHook(() => useConnectivity());
    expect(result.current).toBe(false);
  });

  it("updates for online and offline events", () => {
    const { result } = renderHook(() => useConnectivity());
    onlineState = false;
    act(() => window.dispatchEvent(new Event("offline")));
    expect(result.current).toBe(false);
    onlineState = true;
    act(() => window.dispatchEvent(new Event("online")));
    expect(result.current).toBe(true);
  });

  it("registers stable listeners and removes them on cleanup", () => {
    const { unmount, rerender } = renderHook(() => useConnectivity());
    rerender();
    expect(
      addSpy.mock.calls.filter(([type]) => type === "online"),
    ).toHaveLength(1);
    expect(
      addSpy.mock.calls.filter(([type]) => type === "offline"),
    ).toHaveLength(1);
    unmount();
    expect(
      removeSpy.mock.calls.filter(([type]) => type === "online"),
    ).toHaveLength(1);
    expect(
      removeSpy.mock.calls.filter(([type]) => type === "offline"),
    ).toHaveLength(1);
  });

  it("works after remounting", () => {
    const first = renderHook(() => useConnectivity());
    first.unmount();
    onlineState = false;
    const second = renderHook(() => useConnectivity());
    expect(second.result.current).toBe(false);
    second.unmount();
  });
});
