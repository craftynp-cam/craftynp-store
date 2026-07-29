import type { Metadata } from "next";

import { AboutClosing, AboutHero, AboutStory } from "@/components";
import { toAboutClosing, toAboutHero, toAboutStory } from "@/lib/about-content";
import { fetchSiteContent } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "About",
  description:
    "Meet the maker behind The Crafty NP and how every order is made by hand.",
};

export default async function AboutPage() {
  const siteContent = await fetchSiteContent();

  return (
    <main id="main-content" tabIndex={-1}>
      <AboutHero {...toAboutHero(siteContent)} />
      <AboutStory {...toAboutStory(siteContent)} />
      <AboutClosing {...toAboutClosing(siteContent)} />
    </main>
  );
}
