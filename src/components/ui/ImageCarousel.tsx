"use client";

import Image from "next/image";
import { useState } from "react";
import type { GalleryImage } from "./Gallery";

/**
 * Swipeable image carousel (Elementor's image-carousel / media-carousel).
 * Scroll-snap does the work, so it drags on touch and scrolls with the
 * keyboard without a carousel library.
 */
export default function ImageCarousel({ images }: { images: GalleryImage[] }) {
  const [active, setActive] = useState(0);

  if (!images?.length) return null;

  return (
    <div className="my-8">
      <ul
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4"
        onScroll={(e) => {
          const el = e.currentTarget;
          setActive(Math.round((el.scrollLeft / el.scrollWidth) * images.length));
        }}
      >
        {images.map((img, i) => (
          <li
            key={`${img.src}-${i}`}
            className="relative aspect-3/2 w-[85%] shrink-0 snap-center overflow-hidden rounded-lg bg-mist sm:w-[48%] lg:w-[32%]"
          >
            <Image
              src={img.src}
              alt={img.alt ?? ""}
              fill
              sizes="(min-width: 1024px) 380px, (min-width: 640px) 48vw, 85vw"
              className="object-cover"
              unoptimized={/^https?:\/\//.test(img.src)}
            />
          </li>
        ))}
      </ul>
      <p className="text-center text-sm text-navy/60">
        {active + 1} / {images.length}
      </p>
    </div>
  );
}
