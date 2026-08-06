import type { ReactNode } from "react";

/**
 * Body-copy wrapper for converted WordPress text (Elementor's text-editor).
 * Tailwind's typography plugin isn't installed, so the element styles are
 * declared here — few enough rules that the extra dependency isn't worth it.
 */
export default function Prose({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto max-w-3xl leading-relaxed text-navy/90
        [&_a]:text-green-mid [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-green
        [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-3xl [&_h2]:font-semibold [&_h2]:text-green-dark
        [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:font-display [&_h3]:text-2xl [&_h3]:font-semibold [&_h3]:text-green-dark
        [&_p]:my-4
        [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6
        [&_li]:my-1
        [&_strong]:font-semibold
        [&_blockquote]:border-l-4 [&_blockquote]:border-green [&_blockquote]:pl-4 [&_blockquote]:italic
        ${className}`}
    >
      {children}
    </div>
  );
}
