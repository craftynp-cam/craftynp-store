import { render, screen } from "@testing-library/react";

import { AnnouncementBar } from "@/components";

function mockMatchMedia(matches: boolean) {
  window.matchMedia = jest.fn().mockReturnValue({
    matches,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  });
}

function mockOverflow(overflowing: boolean) {
  Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
    configurable: true,
    value: overflowing ? 2000 : 100,
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    value: 500,
  });
}

function accessibleOccurrences(text: string) {
  return screen
    .getAllByText(text)
    .filter((el) => el.closest('[aria-hidden="true"]') === null);
}

describe("AnnouncementBar", () => {
  const originalMatchMedia = window.matchMedia;
  const originalResizeObserver = window.ResizeObserver;

  beforeEach(() => {
    mockMatchMedia(false);
    mockOverflow(false);
    delete (window as { ResizeObserver?: unknown }).ResizeObserver;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    window.ResizeObserver = originalResizeObserver;
  });

  it("renders the announcement text accessibly, once", () => {
    render(<AnnouncementBar text="Now Selling: GLITTER!" />);

    expect(accessibleOccurrences("Now Selling: GLITTER!")).toHaveLength(1);
  });

  it("duplicates the text for the marquee loop but exposes it once accessibly", () => {
    mockOverflow(true);
    render(<AnnouncementBar text="A very long announcement" />);

    expect(accessibleOccurrences("A very long announcement")).toHaveLength(1);
  });

  it("does not animate when the OS has requested reduced motion", () => {
    mockMatchMedia(true);
    mockOverflow(true);
    const { container } = render(
      <AnnouncementBar text="A very long announcement" />,
    );

    expect(accessibleOccurrences("A very long announcement")).toHaveLength(1);
    expect(
      container.querySelector('[style*="animation"]'),
    ).not.toBeInTheDocument();
  });

  it("does not throw when ResizeObserver is unavailable", () => {
    mockOverflow(true);
    expect(() =>
      render(<AnnouncementBar text="A very long announcement" />),
    ).not.toThrow();
  });
});
