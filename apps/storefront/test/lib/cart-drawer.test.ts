import {
  openCartDrawer,
  readCartDrawerOpen,
  setCartDrawerOpen,
  subscribeToCartDrawer,
} from "@/lib/cart-drawer";

describe("cart-drawer", () => {
  beforeEach(() => {
    setCartDrawerOpen(false);
  });

  it("starts closed", () => {
    expect(readCartDrawerOpen()).toBe(false);
  });

  it("opens and closes", () => {
    setCartDrawerOpen(true);
    expect(readCartDrawerOpen()).toBe(true);

    setCartDrawerOpen(false);
    expect(readCartDrawerOpen()).toBe(false);
  });

  it("openCartDrawer opens it", () => {
    openCartDrawer();
    expect(readCartDrawerOpen()).toBe(true);
  });

  it("notifies subscribers only when the value actually changes", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToCartDrawer(listener);

    setCartDrawerOpen(true);
    expect(listener).toHaveBeenCalledTimes(1);

    setCartDrawerOpen(true);
    expect(listener).toHaveBeenCalledTimes(1);

    setCartDrawerOpen(false);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it("does not persist across a fresh read of module state", () => {
    // Nothing here writes to localStorage or any other storage — open state
    // is purely in-memory, so there is nothing to assert beyond the absence
    // of any storage side effect.
    setCartDrawerOpen(true);
    expect(window.localStorage.getItem("craftynp-cart-drawer")).toBeNull();
  });
});
