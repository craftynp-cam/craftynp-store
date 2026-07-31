export const themePreferences = ["system", "light", "dark"] as const;

export type ThemePreference = (typeof themePreferences)[number];

export const THEME_STORAGE_KEY = "craftynp-theme";

export function isThemePreference(value: unknown): value is ThemePreference {
  return themePreferences.includes(value as ThemePreference);
}

export function readStoredTheme(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

const listeners = new Set<() => void>();

export function subscribeToTheme(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;

  if (preference === "system") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = preference;
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {}

  for (const listener of listeners) listener();
}

export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t}}catch(e){}})()`;

function systemPrefersDark(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function readIsDarkMode(): boolean {
  if (typeof document === "undefined") return false;
  const pinned = document.documentElement.dataset.theme;
  if (pinned === "dark") return true;
  if (pinned === "light") return false;
  return systemPrefersDark();
}

export function subscribeToIsDarkMode(listener: () => void): () => void {
  const unsubscribeTheme = subscribeToTheme(listener);

  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return unsubscribeTheme;
  }

  const mediaQueryList = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQueryList.addEventListener("change", listener);

  return () => {
    unsubscribeTheme();
    mediaQueryList.removeEventListener("change", listener);
  };
}
