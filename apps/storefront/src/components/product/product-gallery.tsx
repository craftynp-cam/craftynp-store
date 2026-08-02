"use client";

import Image from "next/image";
import { useState } from "react";

import type { ProductDetailImage } from "@/lib/product";

type ProductGalleryProps = {
  images: readonly ProductDetailImage[];
  productTitle: string;
};

const placeholderClassName =
  "size-full bg-surface-soft bg-[repeating-linear-gradient(45deg,var(--color-border)_0,var(--color-border)_1px,transparent_1px,transparent_12px)]";

export function ProductGallery({ images, productTitle }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = images[selectedIndex];

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-surface">
        {selected ? (
          <Image
            src={selected.url}
            alt={selected.alt}
            fill
            sizes="(min-width: 1536px) 812px, (min-width: 1280px) 710px, (min-width: 1024px) 46vw, 100vw"
            className="object-cover"
            priority
          />
        ) : (
          <div aria-hidden="true" className={placeholderClassName} />
        )}
      </div>

      {images.length > 1 ? (
        <div className="mt-3 grid grid-cols-4 gap-3">
          {images.map((image, index) => (
            <button
              key={image.url + index}
              type="button"
              aria-pressed={index === selectedIndex}
              aria-label={`Show image ${index + 1} of ${images.length} for ${productTitle}`}
              onClick={() => setSelectedIndex(index)}
              className={`relative aspect-square overflow-hidden rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                index === selectedIndex
                  ? "border-primary ring-2 ring-primary"
                  : "border-border hover:border-border-strong"
              }`}
            >
              <Image
                src={image.url}
                alt=""
                fill
                sizes="10vw"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
