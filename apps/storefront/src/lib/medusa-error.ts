import { FetchError } from "@medusajs/js-sdk";

export function isBackendFailure(error: unknown): boolean {
  if (!(error instanceof FetchError)) return true;
  if (error.status === undefined) return true;
  return (
    error.status === 401 ||
    error.status === 403 ||
    error.status === 404 ||
    error.status >= 500
  );
}

export class MedusaUnavailableError extends Error {
  constructor(what: string, cause: unknown) {
    super(
      `Could not load ${what} from the store backend at ${process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL}.`,
      { cause },
    );
    this.name = "MedusaUnavailableError";
  }
}
