import { applyTheme, readIsDarkMode, subscribeToIsDarkMode } from "@/lib/theme";

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQueryList = {
    matches,
    media: "(prefers-color-scheme: dark)",
    addEventListener: (
      _type: string,
      listener: (event: MediaQueryListEvent) => void,
    ) => {
      listeners.add(listener);
    },
    removeEventListener: (
      _type: string,
      listener: (event: MediaQueryListEvent) => void,
    ) => {
      listeners.delete(listener);
    },
  };
  window.matchMedia = jest.fn().mockReturnValue(mediaQueryList);
  return { listeners, mediaQueryList };
}

describe("readIsDarkMode", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("is true when the theme is pinned to dark, regardless of the OS", () => {
    mockMatchMedia(false);
    document.documentElement.dataset.theme = "dark";
    expect(readIsDarkMode()).toBe(true);
  });

  it("is false when the theme is pinned to light, regardless of the OS", () => {
    mockMatchMedia(true);
    document.documentElement.dataset.theme = "light";
    expect(readIsDarkMode()).toBe(false);
  });

  it("defers to the OS when the theme is unpinned (system)", () => {
    mockMatchMedia(true);
    expect(readIsDarkMode()).toBe(true);

    mockMatchMedia(false);
    expect(readIsDarkMode()).toBe(false);
  });

  it("is false when matchMedia is unavailable and nothing is pinned", () => {
    // @ts-expect-error -- simulating an environment with no matchMedia at all
    delete window.matchMedia;
    expect(readIsDarkMode()).toBe(false);
  });
});

describe("subscribeToIsDarkMode", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("notifies when the OS preference changes while in system mode", () => {
    const { listeners } = mockMatchMedia(false);
    const listener = jest.fn();

    subscribeToIsDarkMode(listener);
    for (const notify of listeners) {
      notify({ matches: true } as MediaQueryListEvent);
    }

    expect(listener).toHaveBeenCalled();
  });

  it("notifies when the pinned theme changes in the same tab", () => {
    mockMatchMedia(false);
    const listener = jest.fn();

    const unsubscribe = subscribeToIsDarkMode(listener);
    applyTheme("dark");

    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it("unsubscribes from both the theme store and the media query list", () => {
    const { mediaQueryList } = mockMatchMedia(false);
    const removeSpy = jest.spyOn(mediaQueryList, "removeEventListener");
    const listener = jest.fn();

    const unsubscribe = subscribeToIsDarkMode(listener);
    unsubscribe();

    expect(removeSpy).toHaveBeenCalledWith("change", listener);

    applyTheme("dark");
    // Called once here would mean the theme-store side never unsubscribed.
    expect(listener).not.toHaveBeenCalled();
  });

  it("still unsubscribes cleanly when matchMedia is unavailable", () => {
    // @ts-expect-error -- simulating an environment with no matchMedia at all
    delete window.matchMedia;
    expect(() => subscribeToIsDarkMode(jest.fn())()).not.toThrow();
  });
});
