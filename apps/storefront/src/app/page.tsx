import type { Metadata } from "next";

import {
  CategoryCarousel,
  MakerIntro,
  StoreUnavailable,
  WorkshopGallery,
} from "@/components";
import { fetchShowcaseCategories } from "@/lib/categories";
import { toMakerIntro, toWorkshopGallery } from "@/lib/home-content";
import { MedusaUnavailableError } from "@/lib/medusa-error";
import { pageMetadata } from "@/lib/page-metadata";
import { fetchSiteContent } from "@/lib/site-content";

export const metadata: Metadata = pageMetadata("/");

export const dynamic = "force-dynamic";

export default async function Home() {
  let categories, siteContent;
  try {
    [categories, siteContent] = await Promise.all([
      fetchShowcaseCategories(),
      fetchSiteContent(),
    ]);
  } catch (error) {
    if (error instanceof MedusaUnavailableError) return <StoreUnavailable />;
    throw error;
  }

  return (
    <main id="main-content" tabIndex={-1}>
      <CategoryCarousel categories={categories} />
      <WorkshopGallery {...toWorkshopGallery(siteContent)} />
      <MakerIntro {...toMakerIntro(siteContent)} />
    </main>
  );
}
