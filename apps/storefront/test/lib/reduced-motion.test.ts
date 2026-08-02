import {
  readPrefersReducedMotion,
  subscribeToReducedMotion,
} from "@/lib/reduced-motion";

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQueryList = {
    matches,
    media: "(prefers-reduced-motion: reduce)",
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

describe("reduced-motion", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("reads false when the OS has not requested reduced motion", () => {
    mockMatchMedia(false);
    expect(readPrefersReducedMotion()).toBe(false);
  });

  it("reads true when the OS has requested reduced motion", () => {
    mockMatchMedia(true);
    expect(readPrefersReducedMotion()).toBe(true);
  });

  it("reads false when matchMedia is unavailable, as in jsdom by default", () => {
    // @ts-expect-error -- simulating an environment with no matchMedia at all
    delete window.matchMedia;
    expect(readPrefersReducedMotion()).toBe(false);
  });

  it("subscribes and unsubscribes through the media query list", () => {
    const { mediaQueryList } = mockMatchMedia(false);
    const addSpy = jest.spyOn(mediaQueryList, "addEventListener");
    const removeSpy = jest.spyOn(mediaQueryList, "removeEventListener");
    const listener = jest.fn();

    const unsubscribe = subscribeToReducedMotion(listener);
    expect(addSpy).toHaveBeenCalledWith("change", listener);

    unsubscribe();
    expect(removeSpy).toHaveBeenCalledWith("change", listener);
  });

  it("returns a no-op unsubscribe when matchMedia is unavailable", () => {
    // @ts-expect-error -- simulating an environment with no matchMedia at all
    delete window.matchMedia;
    expect(() => subscribeToReducedMotion(jest.fn())()).not.toThrow();
  });
});
