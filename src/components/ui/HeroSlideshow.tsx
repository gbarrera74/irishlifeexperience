"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Cross-fading background slideshow, matching the Elementor section background
 * slideshow on the home page. Holds on the first slide when the visitor has
 * asked for reduced motion.
 */
export default function HeroSlideshow({
  slides,
  interval = 5000,
  children,
  className = "",
}: {
  slides: { src: string; alt?: string }[];
  interval?: number;
  children: ReactNode;
  className?: string;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), interval);
    return () => clearInterval(t);
  }, [slides.length, interval]);

  return (
    <section className={`relative flex items-center justify-center overflow-hidden ${className}`}>
      {slides.map((s, i) => (
        <Image
          key={s.src}
          src={s.src}
          alt={i === 0 ? (s.alt ?? "") : ""}
          aria-hidden={i !== 0}
          fill
          priority={i === 0}
          sizes="100vw"
          className={`object-cover transition-opacity duration-1000 ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
      <div className="absolute inset-0 bg-black/[0.34]" aria-hidden="true" />
      <div className="relative w-full">{children}</div>
    </section>
  );
}
