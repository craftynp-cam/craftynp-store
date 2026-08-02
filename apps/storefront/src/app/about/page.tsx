import type { Metadata } from "next";

import {
  AboutClosing,
  AboutHero,
  AboutStory,
  StoreUnavailable,
} from "@/components";
import { toAboutClosing, toAboutHero, toAboutStory } from "@/lib/about-content";
import { MedusaUnavailableError } from "@/lib/medusa-error";
import { SITE_NAME } from "@/lib/site";
import { fetchSiteContent } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "About",
  description: `Meet the maker behind ${SITE_NAME} and how every order is made by hand.`,
};

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  let siteContent;
  try {
    siteContent = await fetchSiteContent();
  } catch (error) {
    if (error instanceof MedusaUnavailableError) return <StoreUnavailable />;
    throw error;
  }

  return (
    <main id="main-content" tabIndex={-1}>
      <AboutHero {...toAboutHero(siteContent)} />
      <AboutStory {...toAboutStory(siteContent)} />
      <AboutClosing {...toAboutClosing(siteContent)} />
    </main>
  );
}
