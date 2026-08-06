import Link from "next/link";
import { happyIcons, type HappyIconName } from "./happyIcons";

export type IconName = HappyIconName;

/**
 * Elementor icon-box, default view: a bare icon (no frame), the title, and a
 * description. Metrics read off the live site — icon 50px, no gap beneath it,
 * title 28px/700 with 16px below, description 16px/24px, all Logo Blue.
 *
 * The icon colour varies per box on the original, so it is passed in rather
 * than fixed.
 */
export default function IconBox({
  icon,
  title,
  description,
  color = "text-accent",
  iconColor,
  href,
}: {
  icon: IconName;
  title: string;
  description?: string;
  /** Tailwind text-colour class for the glyph. */
  color?: string;
  /** Literal colour from the page CSS; wins over `color` when present. */
  iconColor?: string;
  href?: string;
}) {
  const glyph = happyIcons[icon];

  const body = (
    <>
      <span className={`block ${iconColor ? "" : color}`} style={{ color: iconColor }}>
        <svg
          width="50"
          height="50"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className="mx-auto"
        >
          <path d={glyph.path} transform={glyph.transform} />
        </svg>
      </span>
      <h3 className="mb-4 font-display text-[28px] leading-[1.2] font-bold text-navy">
        {title}
      </h3>
      {description && (
        <p className="font-sans text-base leading-6 text-navy">{description}</p>
      )}
    </>
  );

  const classes = "block text-center";

  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
