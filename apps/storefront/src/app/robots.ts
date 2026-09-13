import type { MetadataRoute } from "next";

import { absoluteUrl, DISALLOWED_PATHS } from "@/lib/routes";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...DISALLOWED_PATHS] },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
