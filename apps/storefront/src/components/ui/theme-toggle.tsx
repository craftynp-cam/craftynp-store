"use client";

import { useSyncExternalStore } from "react";

import {
  applyTheme,
  readStoredTheme,
  subscribeToTheme,
  themePreferences,
  type ThemePreference,
} from "@/lib/theme";

import { Moon, Monitor, Sun } from "../icons";

const labels: Record<ThemePreference, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

const compactIcons: Record<ThemePreference, typeof Monitor> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

type ThemeToggleProps = {
  /**
   * "group" is the labelled three-button control shown on /design.
   * "compact" is a single icon button that cycles system → light → dark,
   * sized to sit in the navbar (CNP-24).
   */
  variant?: "group" | "compact";
};

export function ThemeToggle({ variant = "group" }: ThemeToggleProps) {
  // The server cannot know the stored preference, so it renders "system" and
  // the client corrects the highlight on hydration. The inline head script has
  // already applied the real theme by then, so no colour changes here.
  const preference = useSyncExternalStore(
    subscribeToTheme,
    readStoredTheme,
    () => "system" as ThemePreference,
  );

  if (variant === "compact") {
    const currentIndex = themePreferences.indexOf(preference);
    const next =
      themePreferences[(currentIndex + 1) % themePreferences.length]!;
    const Icon = compactIcons[preference];

    return (
      <button
        type="button"
        onClick={() => applyTheme(next)}
        aria-label={`Theme: ${labels[preference]}. Switch to ${labels[next]}.`}
        className="inline-flex size-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Icon aria-hidden="true" size={20} />
      </button>
    );
  }

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
