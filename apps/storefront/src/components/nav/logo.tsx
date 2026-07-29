import Image from "next/image";
import Link from "next/link";

export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Image src="/logo.svg" alt="" width={40} height={40} priority />
      <span className="font-display text-xl text-foreground">
        The Crafty NP
      </span>
    </Link>
  );
}
