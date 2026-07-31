import type { ReactNode } from "react";

export type CardProps = {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function Card({ title, description, children, className }: CardProps) {
  return (
    <section
      className={`rounded-xl border border-border bg-surface p-6 ${className ?? ""}`}
    >
      {title ? (
        <div className="mb-6">
          <h2 className="font-display text-xl text-foreground">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-foreground-muted">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
