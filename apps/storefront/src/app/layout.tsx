import { resolveSiteContent } from "@craftynp/types";

import { Footer, Navbar } from "@/components";
import { fetchNavCategories } from "@/lib/categories";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { fetchSiteContent } from "@/lib/site-content";
import { themeInitScript } from "@/lib/theme";
import type { Metadata } from "next";
import { Cookie, Libre_Baskerville, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const libreBaskerville = Libre_Baskerville({
  variable: "--font-libre-baskerville",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const sourceSans3 = Source_Sans_3({
  variable: "--font-source-sans-3",
  subsets: ["latin"],
  display: "swap",
});

const cookie = Cookie({
  variable: "--font-cookie",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s — ${SITE_NAME}` },
  description: SITE_TAGLINE,
  applicationName: SITE_NAME,
  openGraph: {
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_TAGLINE,
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [categories, siteContent] = await Promise.all([
    fetchNavCategories().catch(() => []),
    fetchSiteContent().catch(() => resolveSiteContent([])),
  ]);
  const announcement =
    siteContent.banner_enabled && siteContent.banner_text
      ? siteContent.banner_text
      : null;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${libreBaskerville.variable} ${sourceSans3.variable} ${cookie.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className="min-h-full flex flex-col"
        style={
          {
            "--announcement-height": announcement ? "2.5rem" : "0rem",
          } as React.CSSProperties
        }
      >
        <Navbar categories={categories} announcement={announcement} />
        <div className="flex-1">{children}</div>
        <Footer categories={categories} />
      </body>
    </html>
  );
}
