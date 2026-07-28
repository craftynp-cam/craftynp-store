import { nextIndex, previousIndex } from "@/lib/carousel";

describe("nextIndex", () => {
  it("advances by one", () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(1, 3)).toBe(2);
  });

  it("wraps from the last slide back to the first", () => {
    expect(nextIndex(2, 3)).toBe(0);
  });

  it("returns 0 for a non-positive total", () => {
    expect(nextIndex(0, 0)).toBe(0);
  });
});

describe("previousIndex", () => {
  it("goes back by one", () => {
    expect(previousIndex(2, 3)).toBe(1);
    expect(previousIndex(1, 3)).toBe(0);
  });

  it("wraps from the first slide back to the last", () => {
    expect(previousIndex(0, 3)).toBe(2);
  });

  it("returns 0 for a non-positive total", () => {
    expect(previousIndex(0, 0)).toBe(0);
  });
});
