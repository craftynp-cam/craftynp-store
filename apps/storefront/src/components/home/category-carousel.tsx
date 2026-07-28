"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import type { ShowcaseCategory } from "@/lib/categories";
import { nextIndex, previousIndex } from "@/lib/carousel";
import { readAnyDrawerOpen, subscribeToDrawers } from "@/lib/drawer-open";
import {
  readPrefersReducedMotion,
  subscribeToReducedMotion,
} from "@/lib/reduced-motion";

import { CaretLeft, CaretRight, Pause, Play } from "../icons";
import { CategorySlide } from "./category-slide";

const AUTO_ADVANCE_MS = 5000;

// The pause/play button's progress ring. Must match the `to` keyframe in
// globals.css (2 * PI * RING_RADIUS).
const RING_RADIUS = 19;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const arrowButtonClassName =
  "flex size-11 shrink-0 items-center justify-center rounded-full bg-off-white/90 text-ink transition-colors hover:bg-off-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-off-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

// AC 11: the carousel's height comes from fixed classes, not slide content,
// so nothing reflows as slides load. Mobile is a square per the mockup; from
// `md` up it fills most of the viewport below the sticky header, leaving a
// hint of the page beneath to imply scrolling.
const shellClassName =
  "relative aspect-square w-full overflow-hidden md:aspect-auto md:h-[calc(100svh-var(--header-height)-4rem)] md:min-h-[28rem]";

type CategoryCarouselProps = { categories: readonly ShowcaseCategory[] };

/**
 * The homepage hero (CNP-29): one full-bleed slide per Medusa category,
 * auto-advancing every 5s with wraparound, pausable by hover, focus, an open
 * drawer, or the visible pause control, and fully inert to
 * `prefers-reduced-motion`.
 */
export function CategoryCarousel({ categories }: CategoryCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocusWithin, setIsFocusWithin] = useState(false);
  const [isPausedByUser, setIsPausedByUser] = useState(false);

  const isAnyDrawerOpen = useSyncExternalStore(
    subscribeToDrawers,
    readAnyDrawerOpen,
    () => false,
  );
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    readPrefersReducedMotion,
    () => false,
  );

  const total = categories.length;
  const canAutoAdvance = total >= 2 && !prefersReducedMotion;
  const isPaused =
    isHovered || isFocusWithin || isAnyDrawerOpen || isPausedByUser;

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bumped whenever the carousel resumes from a pause on the same slide, so
  // the progress ring — keyed on this alongside activeIndex — remounts and
  // restarts in step with the real timer below, which also restarts its
  // full 5s wait on every resume rather than continuing a partial one. This
  // follows React's "adjusting state during render" pattern (a guarded
  // setState call in the render body, not an effect) rather than a
  // useEffect, since the latter would cause an extra, visible render pass.
  const [prevIsPaused, setPrevIsPaused] = useState(isPaused);
  const [runToken, setRunToken] = useState(0);
  if (prevIsPaused !== isPaused) {
    setPrevIsPaused(isPaused);
    if (prevIsPaused && !isPaused) {
      setRunToken((token) => token + 1);
    }
  }

  useEffect(() => {
    if (!canAutoAdvance || isPaused) return;
    timeoutRef.current = setTimeout(() => {
      setActiveIndex((current) => nextIndex(current, total));
    }, AUTO_ADVANCE_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [activeIndex, canAutoAdvance, isPaused, total]);

  if (total === 0) {
    return (
      <div
        className={`${shellClassName} flex items-center justify-center bg-ink`}
      >
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <h1 className="font-display text-3xl text-off-white">
            The Crafty NP
          </h1>
          <p className="max-w-xs text-off-white/80">
            Categories are on their way. Browse everything in the meantime.
          </p>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-base font-semibold text-on-accent transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-off-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            Shop All Products
          </Link>
        </div>
      </div>
    );
  }

  // AC 10: fewer than two categories is a single static slide — no arrows,
  // dots, or pause control, since there is nothing to rotate between.
  if (total === 1) {
    const only = categories[0]!;
    return (
      <div className={shellClassName}>
        <CategorySlide
          name={only.name}
          href={only.href}
          productCount={only.productCount}
          isActive
          position={1}
          total={1}
        />
      </div>
    );
  }

  function goTo(index: number) {
    setActiveIndex(index);
  }

  function goToPrevious() {
    goTo(previousIndex(activeIndex, total));
  }

  function goToNext() {
    goTo(nextIndex(activeIndex, total));
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Shop by category"
      className={shellClassName}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocusWithin(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsFocusWithin(false);
        }
      }}
    >
      <div
        aria-live={isPaused ? "polite" : "off"}
        className="relative size-full overflow-hidden"
      >
        <div
          className="flex h-full transition-transform duration-500 ease-in-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {categories.map((category, index) => (
            <div key={category.href} className="h-full w-full shrink-0">
              <CategorySlide
                name={category.name}
                href={category.href}
                productCount={category.productCount}
                isActive={index === activeIndex}
                position={index + 1}
                total={total}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-6 z-10 flex items-center justify-center gap-3 sm:bottom-8">
        {categories.map((category, index) => (
          <button
            key={category.href}
            type="button"
            onClick={() => goTo(index)}
            aria-label={`Show ${category.name}`}
            aria-current={index === activeIndex ? "true" : undefined}
            className={`h-2.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-off-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink ${
              index === activeIndex
                ? "w-8 bg-gold"
                : "w-2.5 bg-off-white/40 hover:bg-off-white/60"
            }`}
          />
        ))}
      </div>

      {canAutoAdvance ? (
        <button
          type="button"
          onClick={() => setIsPausedByUser((paused) => !paused)}
          aria-label={
            isPausedByUser
              ? "Start automatic slide rotation"
              : "Pause automatic slide rotation"
          }
          className={`${arrowButtonClassName} absolute right-4 bottom-6 z-10 sm:bottom-8`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 44 44"
            className="pointer-events-none absolute inset-0 -rotate-90"
          >
            <circle
              cx="22"
              cy="22"
              r={RING_RADIUS}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.25}
              strokeWidth={2}
            />
            {/* Keyed on runToken so a fresh countdown remounts the circle and
                restarts it from a full ring; pausing only toggles
                animation-play-state, freezing it exactly where it is. */}
            <circle
              key={`${activeIndex}-${runToken}`}
              cx="22"
              cy="22"
              r={RING_RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              style={{
                animation: `carousel-progress ${AUTO_ADVANCE_MS}ms linear forwards`,
                animationPlayState: isPaused ? "paused" : "running",
              }}
            />
          </svg>
          {isPausedByUser ? (
            <Play aria-hidden="true" size={20} />
          ) : (
            <Pause aria-hidden="true" size={20} />
          )}
        </button>
      ) : null}

      <button
        type="button"
        onClick={goToPrevious}
        aria-label="Previous category"
        className={`${arrowButtonClassName} absolute top-1/2 left-4 z-10 -translate-y-1/2`}
      >
        <CaretLeft aria-hidden="true" size={20} />
      </button>
      <button
        type="button"
        onClick={goToNext}
        aria-label="Next category"
        className={`${arrowButtonClassName} absolute top-1/2 right-4 z-10 -translate-y-1/2`}
      >
        <CaretRight aria-hidden="true" size={20} />
      </button>
    </section>
  );
}
