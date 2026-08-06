import Link from "next/link";
import type { ReactNode } from "react";

const variants = {
  // Every button on the site uses --e-global-color-accent (#61CE70), and
  // hovers to a transparent fill with accent text and border.
  green: "bg-accent text-white border border-accent hover:bg-transparent hover:text-accent",
  coral: "bg-coral text-white hover:opacity-90",
  white: "bg-white text-navy hover:bg-mist",
  outline: "border-2 border-current text-navy hover:bg-navy hover:text-white",
} as const;

const sizes = {
  md: "px-7 py-2.5 text-[15px]",
  lg: "px-9 py-3.5",
} as const;

export default function Button({
  href,
  children,
  variant = "green",
  size = "md",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const classes = `inline-block rounded-full font-display font-semibold uppercase tracking-wide transition-colors transition-opacity ${variants[variant]} ${sizes[size]} ${className}`;

  // External destinations (the portal, social, partner sites) stay plain anchors.
  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
