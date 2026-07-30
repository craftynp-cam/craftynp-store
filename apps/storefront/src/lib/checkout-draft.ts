import { EMPTY_CHECKOUT_DRAFT, type CheckoutDraft } from "./checkout";

export const CHECKOUT_STORAGE_KEY = "craftynp-checkout";

const STRING_FIELDS = [
  "email",
  "firstName",
  "lastName",
  "phone",
  "address1",
  "address2",
  "city",
  "state",
  "postalCode",
  "countryCode",
  "billingAddress1",
  "billingAddress2",
  "billingCity",
  "billingState",
  "billingPostalCode",
  "billingCountryCode",
  "savedAddressId",
] as const satisfies readonly (keyof CheckoutDraft)[];

const BOOLEAN_FIELDS = [
  "billingSameAsDelivery",
  "saveAddress",
] as const satisfies readonly (keyof CheckoutDraft)[];

function parseDraft(raw: string | null): CheckoutDraft {
  if (raw == null) return EMPTY_CHECKOUT_DRAFT;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return EMPTY_CHECKOUT_DRAFT;
    }

    const source = parsed as Record<string, unknown>;
    const draft: CheckoutDraft = { ...EMPTY_CHECKOUT_DRAFT };

    for (const field of STRING_FIELDS) {
      const value = source[field];
      if (typeof value === "string") draft[field] = value;
    }

    for (const field of BOOLEAN_FIELDS) {
      const value = source[field];
      if (typeof value === "boolean") draft[field] = value;
    }

    return draft;
  } catch {
    return EMPTY_CHECKOUT_DRAFT;
  }
}

let cachedDraft: CheckoutDraft | null = null;

function readDraftFromStorage(): CheckoutDraft {
  if (cachedDraft != null) return cachedDraft;

  try {
    cachedDraft = parseDraft(window.localStorage.getItem(CHECKOUT_STORAGE_KEY));
  } catch {
    cachedDraft = EMPTY_CHECKOUT_DRAFT;
  }

  return cachedDraft;
}

export function readCheckoutDraft(): CheckoutDraft {
  return readDraftFromStorage();
}

export function readServerCheckoutDraft(): CheckoutDraft {
  return EMPTY_CHECKOUT_DRAFT;
}

const listeners = new Set<() => void>();

export function subscribeToCheckoutDraft(listener: () => void): () => void {
  const onStorage = () => {
    cachedDraft = null;
    listener();
  };

  listeners.add(listener);
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function writeDraft(draft: CheckoutDraft): void {
  cachedDraft = draft;

  try {
    window.localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(draft));
  } catch {}

  for (const listener of listeners) listener();
}

export function patchCheckoutDraft(patch: Partial<CheckoutDraft>): void {
  const current = readDraftFromStorage();
  writeDraft({ ...current, ...patch });
}

export function clearCheckoutDraft(): void {
  writeDraft(EMPTY_CHECKOUT_DRAFT);
}
