import type { MetadataRoute } from "next";

import { absoluteUrl, disallowRules } from "@/lib/routes";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: disallowRules() },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
