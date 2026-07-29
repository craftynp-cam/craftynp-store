import { MedusaError } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { validateSiteContentValue } from "@craftynp/types";
import type { SiteContentEntry } from "@craftynp/types";

import { SITE_CONTENT_MODULE } from "../../modules/site-content";
import type SiteContentModuleService from "../../modules/site-content/service";

type StepInput = { entries: SiteContentEntry[] };

type PreviousEntry = { key: string; value: string | null };

export const upsertSiteContentStep = createStep(
  "upsert-site-content",
  async ({ entries }: StepInput, { container }) => {
    const siteContentModuleService =
      container.resolve<SiteContentModuleService>(SITE_CONTENT_MODULE);

    for (const entry of entries) {
      const result = validateSiteContentValue(entry.key, entry.value);
      if (!result.success) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, result.message);
      }
    }

    const keys = entries.map((entry) => entry.key);
    const existing = await siteContentModuleService.listSiteContentEntries({
      key: keys,
    });
    const existingByKey = new Map(
      existing.map((row) => [row.key, row] as const),
    );

    const previous: PreviousEntry[] = entries.map((entry) => {
      const row = existingByKey.get(entry.key);
      return { key: entry.key, value: row ? row.value : null };
    });

    for (const entry of entries) {
      const row = existingByKey.get(entry.key);
      if (row) {
        await siteContentModuleService.updateSiteContentEntries({
          id: row.id,
          value: entry.value,
        });
      } else {
        await siteContentModuleService.createSiteContentEntries(entry);
      }
    }

    return new StepResponse(entries, { previous });
  },
  async (compensationInput, { container }) => {
    if (!compensationInput) return;

    const siteContentModuleService =
      container.resolve<SiteContentModuleService>(SITE_CONTENT_MODULE);

    const keys = compensationInput.previous.map((entry) => entry.key);
    const existing = await siteContentModuleService.listSiteContentEntries({
      key: keys,
    });
    const existingByKey = new Map(
      existing.map((row) => [row.key, row] as const),
    );

    for (const entry of compensationInput.previous) {
      const row = existingByKey.get(entry.key);
      if (entry.value === null) {
        if (row) {
          await siteContentModuleService.deleteSiteContentEntries(row.id);
        }
      } else if (row) {
        await siteContentModuleService.updateSiteContentEntries({
          id: row.id,
          value: entry.value,
        });
      }
    }
  },
);
