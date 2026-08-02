import {
  CategoryCarousel,
  MakerIntro,
  StoreUnavailable,
  WorkshopGallery,
} from "@/components";
import { fetchShowcaseCategories } from "@/lib/categories";
import { toMakerIntro, toWorkshopGallery } from "@/lib/home-content";
import { MedusaUnavailableError } from "@/lib/medusa-error";
import { fetchSiteContent } from "@/lib/site-content";

// Rendered per request rather than prerendered. This page's content all comes
// from Medusa, and the build deliberately runs without a backend, so a
// prerender either bakes an empty homepage into permanent HTML — what happened
// before CNP-17 — or fails the build outright now that the fetchers throw.
export const dynamic = "force-dynamic";

export default async function Home() {
  let categories, siteContent;
  try {
    [categories, siteContent] = await Promise.all([
      fetchShowcaseCategories(),
      fetchSiteContent(),
    ]);
  } catch (error) {
    // See the note in src/app/products/page.tsx — error.tsx is not reached for
    // a server-side throw on the initial request.
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
