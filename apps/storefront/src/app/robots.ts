import type { MetadataRoute } from "next";

const DISALLOWED = ["/account", "/checkout", "/sign-in", "/auth", "/design"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: DISALLOWED },
  };
}
