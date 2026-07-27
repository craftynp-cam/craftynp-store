import {
  contrastRatio,
  gradeContrast,
  mixOver,
  parseHex,
  toHex,
} from "@/lib/contrast";

describe("parseHex", () => {
  it("splits a hex colour into channels", () => {
    expect(parseHex("#85dfc3")).toEqual([133, 223, 195]);
  });

  it("rejects anything that is not a six-digit hex", () => {
    expect(() => parseHex("#fff")).toThrow(/six-digit hex/);
  });
});

describe("contrastRatio", () => {
  it("returns 21 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  it("returns 1 for a colour against itself", () => {
    expect(contrastRatio("#ebb805", "#ebb805")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#04133b", "#fbfaf7")).toBeCloseTo(
      contrastRatio("#fbfaf7", "#04133b"),
      10,
    );
  });

  it("matches the published ratio for ink navy on off-white", () => {
    expect(contrastRatio("#04133b", "#fbfaf7")).toBeCloseTo(17.32, 2);
  });
});

describe("mixOver", () => {
  it("returns the background at zero alpha", () => {
    expect(toHex(mixOver(parseHex("#04133b"), parseHex("#fbfaf7"), 0))).toBe(
      "#fbfaf7",
    );
  });

  it("returns the foreground at full alpha", () => {
    expect(toHex(mixOver(parseHex("#04133b"), parseHex("#fbfaf7"), 1))).toBe(
      "#04133b",
    );
  });
});

describe("gradeContrast", () => {
  it.each([
    [4.5, "AA"],
    [3, "AA Large"],
    [2.99, "Fail"],
  ])("grades %s as %s", (ratio, grade) => {
    expect(gradeContrast(ratio)).toBe(grade);
  });
});
