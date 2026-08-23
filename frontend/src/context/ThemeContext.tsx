import { useEffect, useMemo, useState, type ReactNode } from "react";
import { THEME_STORAGE_KEY } from "./themeStorage";
import { ThemeContext } from "./themeContext";

export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

function getStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "dark" || stored === "light" || stored === "system" ? stored : "system";
}

function getSystemTheme(): ResolvedTheme {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? getSystemTheme() : preference;
}

function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(getStoredPreference);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(getStoredPreference()));

  useEffect(() => {
    const applyResolvedTheme = () => {
      const nextTheme = resolveTheme(preference);
      setResolvedTheme(nextTheme);
      applyTheme(nextTheme);
    };

    applyResolvedTheme();
    if (preference !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => applyResolvedTheme();
    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, [preference]);

  const setPreference = (nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
  };

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

