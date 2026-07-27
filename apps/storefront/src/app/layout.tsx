import { Navbar } from "@/components";
import { fetchNavCategories } from "@/lib/categories";
import { themeInitScript } from "@/lib/theme";
import type { Metadata } from "next";
import { Libre_Baskerville, Source_Sans_3 } from "next/font/google";
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

export const metadata: Metadata = {
  title: "The Crafty NP",
  description: "Handmade and personalised gifts by The Crafty NP.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const categories = await fetchNavCategories();

  return (
    // themeInitScript sets data-theme on this element before React hydrates,
    // so the server markup cannot match. Suppression is scoped to <html>'s own
    // attributes and does not reach any child.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${libreBaskerville.variable} ${sourceSans3.variable} h-full antialiased`}
    >
      <head>
        {/* Blocking on purpose: a pinned theme must land on <html> before paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Navbar categories={categories} />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
