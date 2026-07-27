import Image from "next/image";
import Link from "next/link";

/**
 * Links home. The monogram is a fixed-size `next/image` so it never causes
 * layout shift (CNP-24 AC 6) — see `public/logo.svg` for the placeholder note.
 */
export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Image src="/logo.svg" alt="" width={40} height={40} priority />
      <span className="flex flex-col leading-tight">
        <span className="font-display text-xl text-foreground">
          The Crafty NP
        </span>
        <span className="text-xs tracking-widest text-foreground-muted uppercase">
          Handmade · Custom
        </span>
      </span>
    </Link>
  );
}
