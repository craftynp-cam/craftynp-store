import Image from "next/image";

const HEADING_ID = "workshop-gallery-heading";

export type WorkshopTile = {
  id: string;
  imageUrl: string;
  caption: string;
};

export type WorkshopGalleryProps = {
  heading: string;
  intro: string;
  tiles: readonly WorkshopTile[];
};

export function WorkshopGallery({
  heading,
  intro,
  tiles,
}: WorkshopGalleryProps) {
  if (!heading || tiles.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby={HEADING_ID}
      className="bg-surface-soft py-16 sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-4">
        <h2 id={HEADING_ID} className="font-display text-3xl sm:text-4xl">
          {heading}
        </h2>
        {intro ? (
          <p className="mt-3 max-w-2xl text-lg text-foreground-muted">
            {intro}
          </p>
        ) : null}

        <ul className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {tiles.map((tile) => (
            <li key={tile.id}>
              <div className="relative aspect-square overflow-hidden rounded-xl bg-surface">
                <Image
                  src={tile.imageUrl}
                  alt={tile.caption}
                  fill
                  sizes="(min-width: 1024px) 25vw, 50vw"
                  className="object-cover"
                />
              </div>
              {tile.caption ? (
                <p className="mt-3 text-sm text-foreground-muted">
                  {tile.caption}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
