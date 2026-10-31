import type { Metadata } from "next";

import { Container, CustomQuoteForm, StoreUnavailable } from "@/components";
import { MedusaUnavailableError } from "@/lib/medusa-error";
import { pageMetadata } from "@/lib/page-metadata";
import { fetchSiteContent } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Request a custom quote",
  description:
    "Tell us what you'd like made — the product, the date you need it and the details — and we'll reply with a quote.",
  ...pageMetadata("/custom-quote"),
};

export const dynamic = "force-dynamic";

const HEADING_ID = "custom-quote-heading";

export default async function CustomQuotePage() {
  let siteContent;
  try {
    siteContent = await fetchSiteContent();
  } catch (error) {
    if (error instanceof MedusaUnavailableError) return <StoreUnavailable />;
    throw error;
  }

  return (
    <main id="main-content" tabIndex={-1}>
      <section aria-labelledby={HEADING_ID} className="bg-ink">
        <Container className="py-14 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-off-white/70">
            Custom orders
          </p>
          <h1
            id={HEADING_ID}
            className="mt-4 font-display text-4xl text-off-white sm:text-5xl"
          >
            Request a custom quote
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-off-white/80">
            Don&apos;t see what you&apos;re looking for? Tell us what you have
            in mind and when you need it, and we&apos;ll get back to you with a
            quote.
          </p>
        </Container>
      </section>
      <Container className="py-12 sm:py-16">
        <div className="max-w-2xl">
          <CustomQuoteForm contactEmail={siteContent.custom_quote_email} />
        </div>
      </Container>
    </main>
  );
}
