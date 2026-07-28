function getMediaQueryList(): MediaQueryList | null {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return null;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)");
}

export function readPrefersReducedMotion(): boolean {
  return getMediaQueryList()?.matches ?? false;
}

export function subscribeToReducedMotion(listener: () => void): () => void {
  const mediaQueryList = getMediaQueryList();
  if (!mediaQueryList) return () => {};
  mediaQueryList.addEventListener("change", listener);
  return () => {
    mediaQueryList.removeEventListener("change", listener);
  };
}
