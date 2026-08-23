import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../src/context/ThemeContext";
import { useTheme } from "../src/context/useTheme";
import { THEME_STORAGE_KEY } from "../src/context/themeStorage";

function ThemeProbe() {
  const { preference, resolvedTheme, setPreference } = useTheme();
  return (
    <div>
      <span data-testid="preference">{preference}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={() => setPreference("dark")}>dark</button>
      <button onClick={() => setPreference("light")}>light</button>
      <button onClick={() => setPreference("system")}>system</button>
    </div>
  );
}

describe("ThemeProvider", () => {
  let matchesDark = false;
  let changeListener: ((event: MediaQueryListEvent) => void) | undefined;
  let addEventListener: ReturnType<typeof vi.fn>;
  let removeEventListener: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    matchesDark = false;
    changeListener = undefined;
    addEventListener = vi.fn((type: string, listener: (event: MediaQueryListEvent) => void) => {
      if (type === "change") changeListener = listener;
    });
    removeEventListener = vi.fn();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn(() => ({
      matches: matchesDark,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addEventListener,
      removeEventListener,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList),
    });
  });

  it("uses Sistema by default and follows the system preference", () => {
    matchesDark = true;
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);

    expect(screen.getByTestId("preference").textContent).toBe("system");
    expect(screen.getByTestId("resolved").textContent).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("applies and persists Claro and Escuro immediately", () => {
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);

    act(() => screen.getByRole("button", { name: "light" }).click());
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    act(() => screen.getByRole("button", { name: "dark" }).click());
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("restores the saved preference after a remount", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    const first = render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    expect(screen.getByTestId("preference").textContent).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");

    first.unmount();
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    expect(screen.getByTestId("preference").textContent).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("reacts to system changes and cleans up its listener", () => {
    const view = render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    expect(addEventListener).toHaveBeenCalledTimes(1);

    matchesDark = true;
    act(() => changeListener?.({ matches: true } as MediaQueryListEvent));
    expect(document.documentElement.dataset.theme).toBe("dark");

    matchesDark = false;
    act(() => changeListener?.({ matches: false } as MediaQueryListEvent));
    expect(document.documentElement.dataset.theme).toBe("light");

    view.unmount();
    expect(removeEventListener).toHaveBeenCalledTimes(1);
  });

  it("does not add duplicate listeners during rerenders", () => {
    const view = render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    act(() => screen.getByRole("button", { name: "system" }).click());
    expect(addEventListener).toHaveBeenCalledTimes(1);
    view.rerender(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    expect(addEventListener).toHaveBeenCalledTimes(1);
  });
});
