"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

export type Partner = { name: string; logo: string; href?: string };

/**
 * Partner logo carousel — the Elementor image-carousel from the home page:
 * three 150x150 logos in view at a time, arrows and pagination dots, looping.
 *
 * The original stretches WordPress's square crops with object-fit: fill. We
 * only have the near-square originals, so these use object-contain — no logo
 * gets cropped or distorted.
 */
export default function PartnerLogos({ partners }: { partners: Partner[] }) {
  const [index, setIndex] = useState(0);
  const [perView, setPerView] = useState(1);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const md = window.matchMedia("(min-width: 640px)");
    const lg = window.matchMedia("(min-width: 1024px)");
    const sync = () => setPerView(lg.matches ? 3 : md.matches ? 2 : 1);
    sync();
    md.addEventListener("change", sync);
    lg.addEventListener("change", sync);
    return () => {
      md.removeEventListener("change", sync);
      lg.removeEventListener("change", sync);
    };
  }, []);

  // Elementor loops: one dot per logo, not per window.
  const loops = partners.length > perView;
  const pages = loops ? partners.length : 1;
  const reel = loops ? [...partners, ...partners.slice(0, perView)] : partners;
  const go = useCallback((n: number) => setIndex(((n % pages) + pages) % pages), [pages]);

  useEffect(() => {
    if (paused || reduceMotion.current || partners.length <= perView) return;
    const t = setTimeout(() => go(index + 1), 4000);
    return () => clearTimeout(t);
  }, [index, paused, go, partners.length, perView]);

  useEffect(() => {
    if (index > pages - 1) setIndex(0);
  }, [pages, index]);

  if (!partners?.length) return null;

  const arrow = (dir: -1 | 1, label: string) => (
    <button
      type="button"
      onClick={() => go(index + dir)}
      className="shrink-0 rounded-full border border-navy/20 p-2 text-navy transition-colors hover:bg-mist"
    >
      <span className="sr-only">{label}</span>
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d={dir === -1 ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );

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
      <div className="flex items-center gap-4">
        {arrow(-1, "Previous partners")}

        <div className="grow overflow-hidden">
          <ul
            className="flex transition-transform duration-500 ease-out"
            style={{
              gap: "20px",
              transform: `translateX(calc(-${index} * (100% + 20px) / ${perView}))`,
            }}
          >
            {reel.map((p, i) => {
              const img = (
                <Image
                  src={p.logo}
                  alt={p.name}
                  width={150}
                  height={150}
                  className="h-[150px] w-[150px] object-contain"
                />
              );
              return (
                <li
                  key={p.name + i}
                  aria-hidden={i >= partners.length}
                  className="flex shrink-0 justify-center"
                  style={{ width: `calc((100% - ${(perView - 1) * 20}px) / ${perView})` }}
                >
                  {p.href ? (
                    <a href={p.href} rel="noopener">
                      {img}
                    </a>
                  ) : (
                    img
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {arrow(1, "Next partners")}
      </div>

      {pages > 1 && (
        <ul className="mt-6 flex justify-center gap-2">
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
                <span className="sr-only">Go to partner group {i + 1}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
