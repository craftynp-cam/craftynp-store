"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  readPrefersReducedMotion,
  subscribeToReducedMotion,
} from "@/lib/reduced-motion";

import { Container } from "../ui";

const PIXELS_PER_SECOND = 60;
const MIN_DURATION_SECONDS = 8;

type AnnouncementBarProps = { text: string };

export function AnnouncementBar({ text }: AnnouncementBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(MIN_DURATION_SECONDS);
  const [isPausedByInteraction, setIsPausedByInteraction] = useState(false);

  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    readPrefersReducedMotion,
    () => false,
  );

  useEffect(() => {
    const container = containerRef.current;
    const measurer = measureRef.current;
    if (!container || !measurer) return;

    function measure() {
      const textWidth = measurer!.scrollWidth;
      const containerWidth = container!.clientWidth;
      setIsOverflowing(textWidth > containerWidth);
      setDurationSeconds(
        Math.max(MIN_DURATION_SECONDS, textWidth / PIXELS_PER_SECOND),
      );
    }

    measure();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [text]);

  const shouldMarquee = isOverflowing && !prefersReducedMotion;

  return (
    <div className="h-10 overflow-hidden bg-ink text-off-white">
      <Container className="h-full">
        <div
          ref={containerRef}
          className="relative flex h-full w-full items-center"
        >
          <span
            ref={measureRef}
            aria-hidden="true"
            className="invisible absolute top-0 left-0 whitespace-nowrap text-sm"
          >
            {text}
          </span>

          {shouldMarquee ? (
            <div
              className="flex w-max shrink-0 whitespace-nowrap"
              style={{
                animation: `marquee ${durationSeconds}s linear infinite`,
                animationPlayState: isPausedByInteraction
                  ? "paused"
                  : "running",
              }}
              onMouseEnter={() => setIsPausedByInteraction(true)}
              onMouseLeave={() => setIsPausedByInteraction(false)}
            >
              <span className="px-4 text-sm">{text}</span>
              <span aria-hidden="true" className="px-4 text-sm">
                {text}
              </span>
            </div>
          ) : (
            <p className="w-full truncate text-center text-sm">{text}</p>
          )}
        </div>
      </Container>
    </div>
  );
}
