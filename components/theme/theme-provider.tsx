"use client";

import * as React from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "sitepulse-theme";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") {
    return "dark";
  }

  return window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") {
    return "dark" as ResolvedTheme;
  }

  const resolvedTheme = theme === "system" ? getSystemTheme() : theme;
  const root = document.documentElement;

  root.classList.toggle("dark", resolvedTheme === "dark");
  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;

  return resolvedTheme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>("dark");

  React.useEffect(() => {
    const storedTheme = (window.localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
    setThemeState(storedTheme);
    setResolvedTheme(applyTheme(storedTheme));
  }, []);

  React.useEffect(() => {
    const media = window.matchMedia(MEDIA_QUERY);

    const handleChange = () => {
      if (theme !== "system") {
        return;
      }

      setResolvedTheme(applyTheme("system"));
    };

    handleChange();
    media.addEventListener("change", handleChange);

    return () => media.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = React.useCallback((nextTheme: Theme) => {
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    setThemeState(nextTheme);
    setResolvedTheme(applyTheme(nextTheme));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}

export const themeScript = `
(() => {
  try {
    const storageKey = "${STORAGE_KEY}";
    const storedTheme = localStorage.getItem(storageKey) || "system";
    const prefersDark = window.matchMedia("${MEDIA_QUERY}").matches;
    const resolvedTheme = storedTheme === "dark" || (storedTheme === "system" && prefersDark) ? "dark" : "light";
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
  } catch (error) {
    document.documentElement.classList.add("dark");
    document.documentElement.dataset.theme = "dark";
    document.documentElement.style.colorScheme = "dark";
  }
})();
`;
