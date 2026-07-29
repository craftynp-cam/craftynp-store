import { CategoryCarousel, MakerIntro, WorkshopGallery } from "@/components";
import { fetchShowcaseCategories } from "@/lib/categories";
import { toMakerIntro, toWorkshopGallery } from "@/lib/home-content";
import { fetchSiteContent } from "@/lib/site-content";

export default async function Home() {
  const [categories, siteContent] = await Promise.all([
    fetchShowcaseCategories(),
    fetchSiteContent(),
  ]);

  return (
    <main id="main-content" tabIndex={-1}>
      <CategoryCarousel categories={categories} />
      <WorkshopGallery {...toWorkshopGallery(siteContent)} />
      <MakerIntro {...toMakerIntro(siteContent)} />
    </main>
  );
}
