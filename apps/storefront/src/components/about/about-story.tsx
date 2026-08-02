const HEADING_ID = "about-story-heading";

export type AboutStoryProps = {
  heading: string;
  paragraphs: readonly string[];
};

export function AboutStory({ heading, paragraphs }: AboutStoryProps) {
  if (!heading && paragraphs.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby={HEADING_ID} className="bg-surface py-16 sm:py-20">
      <div className="mx-auto max-w-2xl px-4">
        <h2 id={HEADING_ID} className="font-display text-3xl sm:text-4xl">
          {heading}
        </h2>
        {paragraphs.map((paragraph, index) => (
          <p
            key={index}
            className="mt-6 text-lg text-foreground-muted first:mt-5"
          >
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}
