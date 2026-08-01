import Image from "next/image";
import Link from "next/link";

import { SITE_NAME } from "@/lib/site";

const plateClassName =
  "grid shrink-0 place-items-center rounded-full bg-blush";

export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span className={`${plateClassName} size-15`}>
        <Image src="/logo.svg" alt="" width={52} height={46} priority />
      </span>
      <span className="font-brand text-2xl leading-none text-foreground">
        {SITE_NAME}
      </span>
    </Link>
  );
}

export function BrandLockup({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <span className={`${plateClassName} size-20`}>
        <Image src="/logo.svg" alt="" width={64} height={57} />
      </span>
      <span className="font-brand text-3xl leading-none">{SITE_NAME}</span>
    </div>
  );
}
