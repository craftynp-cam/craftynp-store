import { CategoryCarousel } from "@/components";
import { fetchShowcaseCategories } from "@/lib/categories";

export default async function Home() {
  const categories = await fetchShowcaseCategories();

  return (
    <main id="main-content" tabIndex={-1}>
      <CategoryCarousel categories={categories} />
    </main>
  );
}
