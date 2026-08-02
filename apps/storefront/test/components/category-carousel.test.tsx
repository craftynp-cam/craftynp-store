import { act, fireEvent, render, screen, within } from "@testing-library/react";

import { CategoryCarousel } from "@/components";
import type { ShowcaseCategory } from "@/lib/categories";
import { setDrawerOpen } from "@/lib/drawer-open";
import { SITE_NAME } from "@/lib/site";

const categories: ShowcaseCategory[] = [
  {
    name: "Shirts",
    href: "/categories/shirts",
    productCount: 2,
    imageUrl: "",
    imageAlt: "",
  },
  {
    name: "Keychains",
    href: "/categories/keychains",
    productCount: 5,
    imageUrl: "",
    imageAlt: "",
  },
  {
    name: "Stickers",
    href: "/categories/stickers",
    productCount: 0,
    imageUrl: "",
    imageAlt: "",
  },
];

function mockMatchMedia(matches: boolean) {
  window.matchMedia = jest.fn().mockReturnValue({
    matches,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  });
}

describe("CategoryCarousel", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    mockMatchMedia(false);
    setDrawerOpen("nav", false);
    setDrawerOpen("cart", false);
    jest.useFakeTimers();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    jest.useRealTimers();
  });

  it("renders one slide per category", () => {
    const { container } = render(<CategoryCarousel categories={categories} />);

    // The other two slides are aria-hidden (AC 8), which empties their
    // computed accessible name, so their aria-label attribute is asserted
    // directly rather than through an accessible-name role query.
    const slides = container.querySelectorAll('[role="group"]');
    expect(
      Array.from(slides).map((slide) => slide.getAttribute("aria-label")),
    ).toEqual(["1 of 3: Shirts", "2 of 3: Keychains", "3 of 3: Stickers"]);
  });

  it("keeps exactly one h1 on the page as slides change", () => {
    render(<CategoryCarousel categories={categories} />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Next category" }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Keychains" }),
    ).toBeInTheDocument();
  });

  it("advances to the next slide automatically after 5 seconds and wraps", () => {
    render(<CategoryCarousel categories={categories} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Shirts" }),
    ).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(5000));
    expect(
      screen.getByRole("heading", { level: 1, name: "Keychains" }),
    ).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(5000));
    expect(
      screen.getByRole("heading", { level: 1, name: "Stickers" }),
    ).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(5000));
    expect(
      screen.getByRole("heading", { level: 1, name: "Shirts" }),
    ).toBeInTheDocument();
  });

  it("moves forward and backward with the prev/next controls, wrapping at the ends", () => {
    render(<CategoryCarousel categories={categories} />);

    fireEvent.click(screen.getByRole("button", { name: "Previous category" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Stickers" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next category" }));
    fireEvent.click(screen.getByRole("button", { name: "Next category" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Keychains" }),
    ).toBeInTheDocument();
  });

  it("renders one dot per slide that reflects and sets the active position", () => {
    render(<CategoryCarousel categories={categories} />);

    const dots = [
      screen.getByRole("button", { name: "Show Shirts" }),
      screen.getByRole("button", { name: "Show Keychains" }),
      screen.getByRole("button", { name: "Show Stickers" }),
    ];
    expect(dots[0]).toHaveAttribute("aria-current", "true");
    expect(dots[1]).not.toHaveAttribute("aria-current");

    fireEvent.click(dots[2]!);

    expect(
      screen.getByRole("heading", { level: 1, name: "Stickers" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show Stickers" }),
    ).toHaveAttribute("aria-current", "true");
  });

  it("provides a visible pause control that stops auto-advance and flips its label", () => {
    render(<CategoryCarousel categories={categories} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Pause automatic slide rotation" }),
    );

    act(() => jest.advanceTimersByTime(10000));
    expect(
      screen.getByRole("heading", { level: 1, name: "Shirts" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start automatic slide rotation" }),
    ).toBeInTheDocument();
  });

  it("pauses auto-advance while the carousel is hovered", () => {
    render(<CategoryCarousel categories={categories} />);
    const carousel = screen.getByRole("region", { name: "Shop by category" });

    fireEvent.mouseEnter(carousel);
    act(() => jest.advanceTimersByTime(5000));
    expect(
      screen.getByRole("heading", { level: 1, name: "Shirts" }),
    ).toBeInTheDocument();

    fireEvent.mouseLeave(carousel);
    act(() => jest.advanceTimersByTime(5000));
    expect(
      screen.getByRole("heading", { level: 1, name: "Keychains" }),
    ).toBeInTheDocument();
  });

  it("pauses auto-advance while focus is within the carousel", () => {
    render(<CategoryCarousel categories={categories} />);

    fireEvent.focus(screen.getByRole("button", { name: "Next category" }));
    act(() => jest.advanceTimersByTime(5000));
    expect(
      screen.getByRole("heading", { level: 1, name: "Shirts" }),
    ).toBeInTheDocument();
  });

  it("pauses auto-advance while any drawer is open", () => {
    render(<CategoryCarousel categories={categories} />);

    act(() => setDrawerOpen("nav", true));
    act(() => jest.advanceTimersByTime(5000));
    expect(
      screen.getByRole("heading", { level: 1, name: "Shirts" }),
    ).toBeInTheDocument();

    act(() => setDrawerOpen("nav", false));
    act(() => jest.advanceTimersByTime(5000));
    expect(
      screen.getByRole("heading", { level: 1, name: "Keychains" }),
    ).toBeInTheDocument();
  });

  it("disables auto-advance and hides the pause control when motion is reduced", () => {
    mockMatchMedia(true);
    render(<CategoryCarousel categories={categories} />);

    act(() => jest.advanceTimersByTime(20000));
    expect(
      screen.getByRole("heading", { level: 1, name: "Shirts" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /automatic slide rotation/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Next category" }),
    ).toBeInTheDocument();
  });

  it("renders a single static slide with no controls when there is only one category", () => {
    render(
      <CategoryCarousel
        categories={[
          {
            name: "Shirts",
            href: "/categories/shirts",
            productCount: 2,
            imageUrl: "",
            imageAlt: "",
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Shirts" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Shop Shirts/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("still offers a CTA and no controls when there are no categories", () => {
    render(<CategoryCarousel categories={[]} />);

    expect(
      within(screen.getByRole("heading", { level: 1 })).getByText(SITE_NAME),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Shop All Products" }),
    ).toHaveAttribute("href", "/products");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
