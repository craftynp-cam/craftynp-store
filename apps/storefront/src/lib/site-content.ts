import { cache } from "react";

import { resolveSiteContent } from "@craftynp/types";
import type { SiteContent } from "@craftynp/types";

import { sdk } from "./medusa";
import { isBackendFailure, MedusaUnavailableError } from "./medusa-error";

type SiteContentResponse = { site_content: SiteContent };

export const fetchSiteContent = cache(async (): Promise<SiteContent> => {
  try {
    const { site_content } = await sdk.client.fetch<SiteContentResponse>(
      "/store/site-content",
      { next: { revalidate: 60 } },
    );
    return site_content;
  } catch (error) {
    if (isBackendFailure(error)) {
      throw new MedusaUnavailableError("the site content", error);
    }
    console.error("Could not load site content", error);
    return resolveSiteContent([]);
  }
});
