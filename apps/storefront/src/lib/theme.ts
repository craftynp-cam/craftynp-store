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
    // Safari in private mode throws on localStorage access.
    return "system";
  }
}

const listeners = new Set<() => void>();

/**
 * Backs `useSyncExternalStore`, which is what lets the control read the stored
 * preference without setting state from an effect. The `storage` event keeps
 * other tabs in step.
 */
export function subscribeToTheme(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/**
 * `system` clears the attribute so the page falls back to `color-scheme:
 * light dark`, which follows the OS.
 */
export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;

  if (preference === "system") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = preference;
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Preference is still applied for this page view.
  }

  for (const listener of listeners) listener();
}

/**
 * Runs before first paint, from a blocking inline script in the document
 * head, so a pinned theme is set on <html> before anything renders. Without
 * it a reader who pinned dark gets a flash of the OS mode.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t}}catch(e){}})()`;
