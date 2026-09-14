import type { OrderEmailContent } from "./order-email";

export type ReplayLedger = {
  content: OrderEmailContent | null;
  exhausted: string | null;
};

export function replayableEmail(content: OrderEmailContent) {
  return { content, provider_data: { replay_content: content } };
}

function isContent(value: unknown): value is OrderEmailContent {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.subject === "string" &&
    typeof record.html === "string" &&
    typeof record.text === "string"
  );
}

export function readReplayLedger(providerData: unknown): ReplayLedger {
  const record =
    providerData !== null && typeof providerData === "object"
      ? (providerData as Record<string, unknown>)
      : {};

  return {
    content: isContent(record.replay_content) ? record.replay_content : null,
    exhausted:
      typeof record.replay_exhausted === "string" && record.replay_exhausted
        ? record.replay_exhausted
        : null,
  };
}

export function withoutReplayContent(
  providerData: Record<string, unknown> | null | undefined,
  exhausted?: string,
): Record<string, unknown> {
  return {
    ...(providerData ?? {}),
    replay_content: null,
    ...(exhausted ? { replay_exhausted: exhausted } : {}),
  };
}
