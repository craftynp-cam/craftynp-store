import { toSitemapEntries } from "@/lib/sitemap";

const ORIGIN = "https://thecraftynp.org";

function urls(paths: readonly string[]): string[] {
  return toSitemapEntries(paths, ORIGIN).map((entry) => entry.url);
}

describe("toSitemapEntries", () => {
  it("lists the static pages, then each category and product, as absolute URLs", () => {
    expect(urls(["/glitter", "/glitter/specialty-glitter"])).toEqual([
      "https://thecraftynp.org/",
      "https://thecraftynp.org/products",
      "https://thecraftynp.org/about",
      "https://thecraftynp.org/glitter",
      "https://thecraftynp.org/glitter/specialty-glitter",
    ]);
  });

  it("drops a product with no category or no handle", () => {
    expect(
      urls(["//orphan-product", "/glitter/", "/glitter/specialty-glitter"]),
    ).toEqual([
      "https://thecraftynp.org/",
      "https://thecraftynp.org/products",
      "https://thecraftynp.org/about",
      "https://thecraftynp.org/glitter/specialty-glitter",
    ]);
  });

  it("leaves out reserved routes but keeps a category whose handle only starts with one", () => {
    expect(
      urls([
        "/account",
        "/account/addresses",
        "/design/tokens",
        "/checkout",
        "/accounting-gifts",
        "/designs",
        "/glitter",
      ]),
    ).toEqual([
      "https://thecraftynp.org/",
      "https://thecraftynp.org/products",
      "https://thecraftynp.org/about",
      "https://thecraftynp.org/accounting-gifts",
      "https://thecraftynp.org/designs",
      "https://thecraftynp.org/glitter",
    ]);
  });

  it("lists a page once when the catalogue repeats it", () => {
    expect(urls(["/products", "/glitter", "/glitter"])).toEqual([
      "https://thecraftynp.org/",
      "https://thecraftynp.org/products",
      "https://thecraftynp.org/about",
      "https://thecraftynp.org/glitter",
    ]);
  });
});
