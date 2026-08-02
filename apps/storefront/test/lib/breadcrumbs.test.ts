import { toBreadcrumbs } from "@/lib/breadcrumbs";

describe("toBreadcrumbs", () => {
  it("returns only Home for the root path, with no href", () => {
    expect(toBreadcrumbs("/")).toEqual([{ label: "Home" }]);
  });

  it("builds one crumb for a single segment", () => {
    expect(toBreadcrumbs("/keychains")).toEqual([
      { label: "Home", href: "/" },
      { label: "Keychains" },
    ]);
  });

  it("builds cumulative hrefs for every crumb except the last", () => {
    expect(toBreadcrumbs("/keychains/wildflower-acrylic-keychain")).toEqual([
      { label: "Home", href: "/" },
      { label: "Keychains", href: "/keychains" },
      { label: "Wildflower Acrylic Keychain" },
    ]);
  });

  it("title-cases hyphenated and underscored segments", () => {
    expect(toBreadcrumbs("/gift_sets/mixed-media-bundle")).toEqual([
      { label: "Home", href: "/" },
      { label: "Gift Sets", href: "/gift_sets" },
      { label: "Mixed Media Bundle" },
    ]);
  });

  it("drops empty segments from a trailing slash", () => {
    expect(toBreadcrumbs("/keychains/")).toEqual([
      { label: "Home", href: "/" },
      { label: "Keychains" },
    ]);
  });

  it("overrides a segment's label when the path has a matching entry", () => {
    expect(toBreadcrumbs("/products", { "/products": "All products" })).toEqual(
      [{ label: "Home", href: "/" }, { label: "All products" }],
    );
  });

  it("uses a label override for the real category name over the title-cased handle", () => {
    expect(toBreadcrumbs("/t-shirts", { "/t-shirts": "T-Shirts" })).toEqual([
      { label: "Home", href: "/" },
      { label: "T-Shirts" },
    ]);
  });

  it("falls back to title-casing for a segment with no override", () => {
    expect(
      toBreadcrumbs("/keychains/wildflower-acrylic-keychain", {
        "/keychains": "Keychains",
      }),
    ).toEqual([
      { label: "Home", href: "/" },
      { label: "Keychains", href: "/keychains" },
      { label: "Wildflower Acrylic Keychain" },
    ]);
  });
});
