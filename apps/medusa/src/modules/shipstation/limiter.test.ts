import { acquire, blockFor, configure, __resetForTests } from "./limiter.js";

describe("shipstation rate limiter", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    __resetForTests();
    configure(60);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("serialises concurrent acquire calls against the shared bucket", async () => {
    __resetForTests();
    configure(1);

    const first = acquire();
    await jest.advanceTimersByTimeAsync(0);
    await first;

    const second = acquire();
    let resolved = false;
    void second.then(() => {
      resolved = true;
    });

    await jest.advanceTimersByTimeAsync(0);
    expect(resolved).toBe(false);

    await jest.advanceTimersByTimeAsync(60_000);
    await second;
    expect(resolved).toBe(true);
  });

  it("installs only one timer when two blockFor calls overlap", async () => {
    const setTimeoutSpy = jest.spyOn(global, "setTimeout");

    blockFor(5000);
    const callsAfterFirst = setTimeoutSpy.mock.calls.length;
    blockFor(5000);
    const callsAfterSecond = setTimeoutSpy.mock.calls.length;

    expect(callsAfterSecond).toBe(callsAfterFirst);
  });

  it("resolves all waiters on the same tick once the block clears", async () => {
    __resetForTests();
    configure(60);
    blockFor(5000);

    const waiterA = acquire();
    const waiterB = acquire();
    let resolvedA = false;
    let resolvedB = false;
    void waiterA.then(() => {
      resolvedA = true;
    });
    void waiterB.then(() => {
      resolvedB = true;
    });

    await jest.advanceTimersByTimeAsync(4000);
    expect(resolvedA).toBe(false);
    expect(resolvedB).toBe(false);

    await jest.advanceTimersByTimeAsync(1000);
    await Promise.all([waiterA, waiterB]);
    expect(resolvedA).toBe(true);
    expect(resolvedB).toBe(true);
  });
});
