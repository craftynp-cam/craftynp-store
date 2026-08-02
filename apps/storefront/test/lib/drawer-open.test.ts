import {
  readAnyDrawerOpen,
  setDrawerOpen,
  subscribeToDrawers,
} from "@/lib/drawer-open";

describe("drawer-open", () => {
  beforeEach(() => {
    setDrawerOpen("nav", false);
    setDrawerOpen("cart", false);
  });

  it("starts closed", () => {
    expect(readAnyDrawerOpen()).toBe(false);
  });

  it("reports open once a single drawer opens", () => {
    setDrawerOpen("nav", true);
    expect(readAnyDrawerOpen()).toBe(true);
  });

  it("stays open while a second drawer opens and closes", () => {
    setDrawerOpen("nav", true);
    setDrawerOpen("cart", true);
    expect(readAnyDrawerOpen()).toBe(true);

    setDrawerOpen("cart", false);
    expect(readAnyDrawerOpen()).toBe(true);
  });

  it("only reports closed once every open drawer has closed", () => {
    setDrawerOpen("nav", true);
    setDrawerOpen("cart", true);

    setDrawerOpen("nav", false);
    expect(readAnyDrawerOpen()).toBe(true);

    setDrawerOpen("cart", false);
    expect(readAnyDrawerOpen()).toBe(false);
  });

  it("notifies subscribers only when the overall value actually changes", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToDrawers(listener);

    setDrawerOpen("nav", true);
    expect(listener).toHaveBeenCalledTimes(1);

    setDrawerOpen("cart", true);
    expect(listener).toHaveBeenCalledTimes(1);

    setDrawerOpen("nav", false);
    expect(listener).toHaveBeenCalledTimes(1);

    setDrawerOpen("cart", false);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it("does not drift when the same drawer reports the same state twice", () => {
    setDrawerOpen("nav", true);
    setDrawerOpen("nav", true);
    setDrawerOpen("nav", false);

    expect(readAnyDrawerOpen()).toBe(false);
  });
});
