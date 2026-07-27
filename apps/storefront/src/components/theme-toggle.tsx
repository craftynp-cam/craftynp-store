"use client";

import { useSyncExternalStore } from "react";

import {
  applyTheme,
  readStoredTheme,
  subscribeToTheme,
  themePreferences,
  type ThemePreference,
} from "@/lib/theme";

const labels: Record<ThemePreference, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

export function ThemeToggle() {
  // The server cannot know the stored preference, so it renders "system" and
  // the client corrects the highlight on hydration. The inline head script has
  // already applied the real theme by then, so no colour changes here.
  const preference = useSyncExternalStore(
    subscribeToTheme,
    readStoredTheme,
    () => "system" as ThemePreference,
  );

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className="inline-flex rounded-lg border border-border bg-surface p-1"
    >
      {themePreferences.map((option) => {
        const selected = option === preference;

        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => applyTheme(option)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              selected
                ? "bg-primary text-on-primary"
                : "text-foreground-muted hover:text-foreground"
            }`}
          >
            {labels[option]}
          </button>
        );
      })}
    </div>
  );
}
