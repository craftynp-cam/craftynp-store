import type { MetadataRoute } from "next";

import { absoluteUrl, DISALLOWED_PATHS, siteOrigin } from "./routes";

const STATIC_PATHS = ["/", "/products", "/about"];

function isListable(path: string): boolean {
  const segments = path.slice(1).split("/");
  return (
    segments.every((segment) => segment !== "") &&
    !DISALLOWED_PATHS.some((prefix) => path.startsWith(prefix))
  );
}

export function toSitemapEntries(
  catalogPaths: readonly string[],
  origin: string = siteOrigin(),
): MetadataRoute.Sitemap {
  const paths = new Set([...STATIC_PATHS, ...catalogPaths.filter(isListable)]);
  return [...paths].map((path) => ({ url: absoluteUrl(path, origin) }));
}
