"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GalleryImage } from "./Gallery";

/**
 * Elementor's image-carousel / media-carousel.
 *
 * The behaviour here is Elementor's defaults, which is what the source site
 * relies on: it stores none of these settings unless an editor changed them,
 * so a carousel that reads "empty" in the export is still autoplaying every
 * five seconds with an infinite loop, arrows and one dot per slide.
 *
 * Two deliberate departures from the original, both accessibility fixes that
 * cost nothing visually: rotation stops on hover *and* on keyboard focus, and
 * it never starts for a visitor who asked for reduced motion.
 */
export default function ImageCarousel({
  images,
  perView = 3,
  thumb = false,
  autoplay = true,
  autoplaySpeed = 5000,
  speed = 500,
  infinite = true,
  pauseOnHover = true,
  navigation = "both",
}: {
  images: GalleryImage[];
  perView?: number;
  /** Elementor's default 150x150 thumbnail box, used by the partner logos. */
  thumb?: boolean;
  autoplay?: boolean;
  autoplaySpeed?: number;
  speed?: number;
  infinite?: boolean;
  pauseOnHover?: boolean;
  navigation?: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [view, setView] = useState(1);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wide = window.matchMedia("(min-width: 1025px)");
    const mid = window.matchMedia("(min-width: 768px)");
    const sync = () => setView(wide.matches ? perView : mid.matches ? Math.min(2, perView) : 1);
    sync();
    wide.addEventListener("change", sync);
    mid.addEventListener("change", sync);
    return () => {
      wide.removeEventListener("change", sync);
      mid.removeEventListener("change", sync);
    };
  }, [perView]);

  // Elementor gives a looping carousel one dot per slide; a non-looping one
  // gets a dot per window position.
  const pages = infinite ? images.length : Math.max(1, images.length - view + 1);

  const go = useCallback(
    (n: number) => {
      if (infinite) setIndex(((n % pages) + pages) % pages);
      else setIndex(Math.max(0, Math.min(n, pages - 1)));
    },
    [infinite, pages],
  );

  useEffect(() => {
    if (!autoplay || paused || reduceMotion.current || images.length <= view) return;
    const t = setInterval(() => go(index + 1), autoplaySpeed);
    return () => clearInterval(t);
  }, [autoplay, paused, autoplaySpeed, index, go, images.length, view]);

  if (!images?.length) return null;

  const showArrows = navigation === "both" || navigation === "arrows";
  const showDots = navigation === "both" || navigation === "dots";
  const arrow =
    "absolute top-1/2 z-10 -translate-y-1/2 px-3 py-2 text-3xl leading-none text-[#19447359] transition hover:text-navy";

  return (
    <div
      className="relative my-8"
      onMouseEnter={() => pauseOnHover && setPaused(true)}
      onMouseLeave={() => pauseOnHover && setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Image carousel"
    >
      <div className="overflow-hidden">
        <ul
          className="flex"
          style={{
            transform: `translateX(-${index * (100 / view)}%)`,
            transition: reduceMotion.current ? undefined : `transform ${speed}ms ease`,
          }}
        >
          {images.map((img, i) => (
            <li
              key={`${img.src}-${i}`}
              className={
                thumb ? "flex shrink-0 items-center justify-center" : "relative shrink-0 px-2"
              }
              style={{ flexBasis: `${100 / view}%`, maxWidth: `${100 / view}%` }}
              aria-hidden={i < index || i >= index + view}
            >
              {thumb ? (
                // Square 150x150 like the original, but contained rather than
                // hard-cropped: these are logos, and cropping cuts them off.
                <Image
                  src={img.src}
                  alt={img.alt ?? ""}
                  width={150}
                  height={150}
                  className="h-[150px] w-[150px] object-contain"
                  unoptimized={/^https?:\/\//.test(img.src)}
                />
              ) : (
                <div className="relative aspect-3/2 w-full overflow-hidden rounded-lg bg-mist">
                  <Image
                    src={img.src}
                    alt={img.alt ?? ""}
                    fill
                    sizes="(min-width: 1024px) 380px, (min-width: 640px) 48vw, 85vw"
                    className="object-cover"
                    unoptimized={/^https?:\/\//.test(img.src)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {showArrows && images.length > view && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            className={`${arrow} left-0`}
            aria-label="Previous"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            className={`${arrow} right-0`}
            aria-label="Next"
          >
            ›
          </button>
        </>
      )}

      {showDots && pages > 1 && (
        <ul className="mt-4 flex justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={`block h-2 w-2 rounded-full transition ${
                  i === index ? "bg-[#194473]" : "bg-[#19447359]"
                }`}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
