"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

export type Testimonial = {
  quote: string;
  name: string;
  detail?: string;
  image?: string;
};

/**
 * Testimonial carousel, matching the Elementor original: two slides visible at
 * a time with a 22px gutter, each a 120px circular photo beside left-aligned
 * copy. Pagination dots only — the original has no arrows.
 *
 * Name/role/quote typography comes from the page CSS rather than being baked
 * in: the sister site sets the name at 30px but this one sets it at 20px, and
 * a hardcoded size silently renders the wrong one.
 *
 * Elementor's version auto-rotated with no way to stop it and no keyboard
 * access. This one pauses on hover and focus, honours prefers-reduced-motion,
 * and announces slide changes.
 */
export default function TestimonialCarousel({
  items,
  interval = 6000,
  quoteStyle,
  nameStyle,
  detailStyle,
}: {
  items: Testimonial[];
  interval?: number;
  quoteStyle?: CSSProperties;
  nameStyle?: CSSProperties;
  detailStyle?: CSSProperties;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [perView, setPerView] = useState(1);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setPerView(mq.matches ? 2 : 1);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Elementor loops, so there is one dot per slide rather than per window.
  const loops = items.length > perView;
  const pages = loops ? items.length : 1;
  // Only duplicate when the list actually scrolls — otherwise every slide
  // would appear twice in the DOM (and twice in the page text).
  const reel = loops ? [...items, ...items.slice(0, perView)] : items;
  const go = useCallback((n: number) => setIndex(((n % pages) + pages) % pages), [pages]);

  useEffect(() => {
    if (paused || reduceMotion.current || items.length <= perView) return;
    const t = setTimeout(() => go(index + 1), interval);
    return () => clearTimeout(t);
  }, [index, paused, interval, go, items.length, perView]);

  useEffect(() => {
    if (index > pages - 1) setIndex(0);
  }, [pages, index]);

  if (!items?.length) return null;

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(index - 1);
        if (e.key === "ArrowRight") go(index + 1);
      }}
    >
      <div className="overflow-hidden" aria-live="polite">
        <ul
          className="flex transition-transform duration-500 ease-out"
          style={{
            gap: "22px",
            transform: `translateX(calc(-${index} * (100% + 22px) / ${perView}))`,
          }}
        >
          {reel.map((t, i) => (
            <li
              key={t.name + i}
              data-clone={i >= items.length ? "1" : undefined}
              aria-hidden={i >= items.length}
              className="flex shrink-0 items-center gap-5 text-left"
              style={{ width: `calc((100% - ${(perView - 1) * 22}px) / ${perView})` }}
            >
              {t.image && (
                <Image
                  src={t.image}
                  alt=""
                  width={120}
                  height={120}
                  className="h-[120px] w-[120px] shrink-0 rounded-full object-cover"
                />
              )}
              <div>
                <p className="elementor-testimonial__text font-sans text-base leading-6 text-navy" style={quoteStyle}>
                  {t.quote}
                </p>
                <p
                  className="elementor-testimonial__name mt-3 font-black text-coral uppercase"
                  style={{ lineHeight: 1.5, ...nameStyle }}
                >
                  {t.name}
                </p>
                {t.detail && (
                  <p className="elementor-testimonial__title font-sans text-base text-navy uppercase" style={detailStyle}>
                    {t.detail}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {pages > 1 && (
        <ul className="mt-8 flex justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={i === index}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  i === index ? "bg-navy" : "bg-navy/25 hover:bg-navy/50"
                }`}
              >
                <span className="sr-only">Go to testimonial {i + 1}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
