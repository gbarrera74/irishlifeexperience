import type { ReactNode } from "react";

const tones = {
  white: "bg-white",
  mist: "bg-mist",
  sand: "bg-sand",
  sky: "bg-sky",
  green: "bg-green-dark text-white",
} as const;

export type SectionTone = keyof typeof tones;

/**
 * Standard page section. The old site wrapped everything in Elementor
 * containers whose content box is 1170px inside 20px of section padding; this reproduces that rhythm.
 */
export default function Section({
  children,
  tone = "white",
  className = "",
  compact = false,
}: {
  children: ReactNode;
  tone?: SectionTone;
  className?: string;
  compact?: boolean;
}) {
  return (
    <section className={`${tones[tone]} ${className}`}>
      <div
        className={`mx-auto max-w-[1210px] px-5 ${compact ? "py-10" : "py-16 lg:py-20"}`}
      >
        {children}
      </div>
    </section>
  );
}
