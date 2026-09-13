import { validateCategoryArtwork } from "@craftynp/types";
import { MedusaError } from "@medusajs/framework/utils";

export type CategoryArtworkInput = {
  id?: string;
  metadata?: Record<string, unknown> | null;
};

export function assertCategoryArtwork(
  categories: readonly CategoryArtworkInput[],
): void {
  for (const category of categories) {
    const problem = validateCategoryArtwork(category.metadata);
    if (problem.ok) continue;

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Category ${category.id ?? "(new)"} — ${problem.message}`,
    );
  }
}
