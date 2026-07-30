import { applyRetryAfter, takeToken, type BucketState } from "./lib";

let state: BucketState = { tokens: 0, lastRefillMs: 0, blockedUntilMs: 0 };
let gate: Promise<void> | null = null;
let configured = false;
let ratePerMinute = 60;
let capacity = 60;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function configure(rateLimitPerMinute: number): void {
  ratePerMinute = rateLimitPerMinute;
  capacity = rateLimitPerMinute;
  if (!configured) {
    state = { tokens: capacity, lastRefillMs: Date.now(), blockedUntilMs: 0 };
    configured = true;
  }
}

export async function acquire(): Promise<void> {
  for (;;) {
    if (gate) await gate;

    const now = Date.now();
    const next = takeToken(state, now, ratePerMinute, capacity);

    if (next.waitMs === 0) {
      state = next.state;
      return;
    }

    await sleep(next.waitMs);
  }
}

export function blockFor(ms: number): void {
  state = applyRetryAfter(state, Date.now(), ms);

  if (!gate) {
    gate = sleep(ms).finally(() => {
      gate = null;
    });
  }
}

export function __resetForTests(): void {
  state = { tokens: capacity, lastRefillMs: Date.now(), blockedUntilMs: 0 };
  gate = null;
  configured = false;
}
