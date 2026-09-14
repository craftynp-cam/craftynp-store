import type { Metadata } from "next";

import { SITE_NAME } from "./site";

export type PageImage = { url: string; alt: string };

export function pageMetadata(path: string, image?: PageImage): Metadata {
  return {
    alternates: { canonical: path },
    openGraph: {
      siteName: SITE_NAME,
      type: "website",
      url: path,
      images: image ? [image] : undefined,
    },
  };
}
