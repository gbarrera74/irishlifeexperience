import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import IconBox from "@/components/ui/IconBox";
import TestimonialCarousel from "@/components/ui/TestimonialCarousel";
import ImageCarousel from "@/components/ui/ImageCarousel";
import Gallery from "@/components/ui/Gallery";
import VideoEmbed from "@/components/ui/VideoEmbed";
import WordPressForm from "@/components/ui/WordPressForm";
import { happyIcons, type HappyIconName } from "@/components/ui/happyIcons";
import type { FormField } from "@/components/ui/WordPressForm";
import { recentPosts } from "@/lib/blog";
import { sitemapPages } from "@/lib/pages";

/**
 * Renders the block trees produced by scripts/extract_pages.py.
 *
 * Styling comes from the CSS Elementor generated for each page, applied as
 * inline styles. That is deliberate: the widget settings in the export only
 * record explicit overrides, so anything inherited from the theme or kit — most
 * font sizes, most colours — is absent there but present in the CSS.
 */

export type StyleMap = Record<string, Record<string, string>>;
export type Block = {
  type: string;
  id?: string;
  style?: StyleMap;
  children?: Block[];
  [key: string]: unknown;
};

const KEBAB = /-([a-z])/g;

function toStyle(props?: Record<string, string>): CSSProperties {
  if (!props) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(props)) {
    out[k.replace(KEBAB, (_, c) => c.toUpperCase())] = v;
  }
  return out as CSSProperties;
}

/**
 * Interaction states, which must never be folded into the resting style.
 *
 * Skipping only :hover is not enough. Elementor writes a :focus rule alongside
 * it, and because these are merged in source order the :focus declarations were
 * landing on top — every button rendered with its focus colours (transparent
 * background, green text) instead of its real ones.
 */
const STATEFUL = /:(hover|focus|active|visited|focus-within|focus-visible)\b/;

/** First value for `prop` across the element's sub-selectors, resting state only. */
function pick(style: StyleMap | undefined, prop: string, match?: RegExp): string | undefined {
  if (!style) return undefined;
  for (const [sel, props] of Object.entries(style)) {
    if (STATEFUL.test(sel) || sel.includes("motion-effects-layer")) continue;
    if (match && !match.test(sel)) continue;
    if (props[prop]) return props[prop];
  }
  return undefined;
}

/** Merge the typography/colour declarations for a widget's inner element. */
function typography(style: StyleMap | undefined, match: RegExp): CSSProperties {
  if (!style) return {};
  const merged: Record<string, string> = {};
  for (const [sel, props] of Object.entries(style)) {
    if (STATEFUL.test(sel)) continue;
    if (!match.test(sel)) continue;
    Object.assign(merged, props);
  }
  return toStyle(merged);
}

function localSrc(src?: string) {
  return src && src.startsWith("/") ? src : undefined;
}

// ---------------------------------------------------------------- containers

function SectionBlock({ block }: { block: Block }) {
  const base = block.style?.[""] ?? {};
  const bg = pick(block.style, "background-color");
  const bgImage = block.bgImage as string | undefined;
  const slideshow = block.slideshow as string[] | undefined;
  const overlay = block.style?.["> .elementor-background-overlay"];
  const container = block.style?.["> .elementor-container"] ?? {};

  const hasMedia = Boolean(bgImage || slideshow?.length);

  return (
    <section
      data-el={block.id}
      className="relative w-full"
      style={{
        backgroundColor: bg,
        padding: base.padding,
        margin: base.margin,
      }}
    >
      {hasMedia && (
        <Image
          src={(slideshow?.[0] ?? bgImage) as string}
          alt=""
          fill
          sizes="100vw"
          // Elementor paints section backgrounds with CSS rather than an <img>;
          // marked so inventory checks do not read this as extra content.
          data-bg="1"
          className="object-cover"
          unoptimized={!localSrc(slideshow?.[0] ?? bgImage)}
        />
      )}
      {overlay && (
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundColor: overlay["background-color"],
            opacity: overlay.opacity,
          }}
        />
      )}
      <div
        className="relative mx-auto flex w-full flex-wrap"
        style={{
          maxWidth: container["max-width"] ?? "1170px",
          minHeight: container["min-height"],
        }}
      >
        <Blocks blocks={block.children ?? []} />
      </div>
    </section>
  );
}

function ColumnBlock({ block }: { block: Block }) {
  const width = typeof block.width === "number" ? block.width : undefined;
  const bg = pick(block.style, "background-color");
  const radius = pick(block.style, "border-radius");
  const padding = pick(block.style, "padding", /populated|^$/);

  return (
    // Width goes through a custom property rather than an inline flex-basis so
    // the stacking breakpoint in globals.css can still override it — an inline
    // width would pin the column at its desktop share on phones.
    <div
      className="e-col min-w-0 grow"
      style={{ "--col-w": width ? `${width}%` : "100%" } as CSSProperties}
    >
      <div
        data-el={block.id}
        className="h-full"
        style={{
          backgroundColor: bg,
          borderRadius: radius,
          padding,
          margin: pick(block.style, "margin", /populated|^$/),
          overflow: radius ? "hidden" : undefined,
        }}
      >
        <Blocks blocks={block.children ?? []} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ widgets

// Elementor's heading size presets, from widget-heading.min.css. They are
// applied as classes rather than declarations, so they never appear in the
// per-page CSS the extractor reads.
const HEADING_SIZES: Record<string, string> = {
  small: "15px",
  medium: "19px",
  large: "29px",
  xl: "39px",
  xxl: "59px",
};

function Heading({ block }: { block: Block }) {
  const Tag = ((block.tag as string) || "h2") as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  const align = block.style?.[""]?.["text-align"];
  const type = typography(block.style, /heading-title/);
  const preset = HEADING_SIZES[(block.size as string) ?? ""];
  const text = block.text as string;
  // An explicit font-size in the page CSS still wins over the preset.
  // Elementor's .elementor-heading-title resets line-height to 1. Anything the
  // page CSS declares still wins, since `type` spreads last.
  const inner = <Tag style={{ lineHeight: 1, fontSize: preset, ...type }}>{text}</Tag>;
  return (
    <div style={{ textAlign: align as CSSProperties["textAlign"] }}>
      {block.link ? <Link href={block.link as string}>{inner}</Link> : inner}
    </div>
  );
}

function TextEditor({ block }: { block: Block }) {
  const type = typography(block.style, /^$|editor/);
  return (
    <div
      className="wp-text [&_a]:text-green-mid [&_a]:underline [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_strong]:font-semibold [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
      style={type}
      dangerouslySetInnerHTML={{ __html: block.html as string }}
    />
  );
}

function ImageWidget({ block }: { block: Block }) {
  const src = block.src as string | undefined;
  if (!src) return null;
  const align = block.style?.[""]?.["text-align"];
  // Elementor targets the <img> itself for height, radius and opacity.
  const imgStyle = typography(block.style, /(^|\s)img$/);
  // The original sets object-fit: fill, which stretches the photo to whatever
  // height it declares. Filling the same box with cover keeps the card geometry
  // identical without distorting the picture.
  const fitted = imgStyle.height ? ({ objectFit: "cover" } as CSSProperties) : {};
  // Applied after the extracted styles so a declared `fill` cannot reintroduce
  // the stretch on individual cards.
  const fitOverride = imgStyle.height ? fitted : {};
  const img = (
    <Image
      src={src}
      alt={(block.alt as string) || ""}
      width={1200}
      height={800}
      sizes="(min-width: 1024px) 600px, 100vw"
      className={imgStyle.height ? "w-full" : "h-auto w-full"}
      style={{ ...fitted, ...imgStyle, ...fitOverride }}
      unoptimized={!localSrc(src)}
    />
  );
  const caption = (block.caption as string | undefined)?.trim();
  const body = block.link ? <Link href={block.link as string}>{img}</Link> : img;
  return (
    <div style={{ textAlign: align as CSSProperties["textAlign"] }}>
      {caption ? (
        <figure>
          {body}
          <figcaption
            className="mt-2 text-sm text-navy/70"
            style={typography(block.style, /caption/)}
          >
            {caption}
          </figcaption>
        </figure>
      ) : (
        body
      )}
    </div>
  );
}

function ButtonWidget({ block }: { block: Block }) {
  const style = typography(block.style, /elementor-button/);
  const href = (block.link as string) || "#";
  const align = block.style?.[""]?.["text-align"];
  const cls =
    "elementor-button inline-block px-8 py-3 transition-opacity hover:opacity-90 " +
    (style.backgroundColor ? "" : "bg-accent text-white ");
  // .elementor-button's own defaults, below anything the page CSS sets.
  const base: CSSProperties = { fontSize: "15px", lineHeight: 1 };
  return (
    <div style={{ textAlign: align as CSSProperties["textAlign"] }}>
      {/^https?:\/\//.test(href) ? (
        <a href={href} className={cls} style={{ ...base, ...style }}>
          {block.text as string}
        </a>
      ) : (
        <Link href={href} className={cls} style={{ ...base, ...style }}>
          {block.text as string}
        </Link>
      )}
    </div>
  );
}

function IconBoxWidget({ block }: { block: Block }) {
  const raw = ((block.icon as string) || "").replace(/^hm\s+hm-/, "");
  const icon = (raw in happyIcons ? raw : "compass") as HappyIconName;
  const color = pick(block.style, "color", /icon/) ?? undefined;
  return (
    <IconBox
      icon={icon}
      title={block.title as string}
      description={block.description as string}
      href={block.link as string | undefined}
      color=""
      iconColor={color}
    />
  );
}

function IconList({ block }: { block: Block }) {
  const items = (block.items ?? []) as { text: string; link?: string }[];
  return (
    <ul className="space-y-2">
      {items.map((i, n) => (
        <li key={n} className="flex gap-2">
          <span aria-hidden="true" className="text-accent">
            •
          </span>
          {i.link ? (
            <Link href={i.link} className="text-navy hover:text-accent">
              {i.text}
            </Link>
          ) : (
            <span className="text-navy">{i.text}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Spacer({ block }: { block: Block }) {
  return <div aria-hidden="true" style={{ height: `${(block.size as number) ?? 50}px` }} />;
}

function Divider() {
  return <hr className="my-6 border-navy/15" />;
}

type PostCard = { title: string; href: string; image?: string; excerpt?: string; date?: string };

/**
 * Elementor's posts widget. When it filters on a term the extractor resolves
 * the query at build time and hands the exact list over in `items` — /alumni/
 * uses it to show the 13 ambassador pages, not blog posts. Otherwise it falls
 * back to recent posts, which is what the home page and /blog/ want.
 */
function formatPostDate(raw?: string) {
  if (!raw) return null;
  const d = new Date(raw.replace(" ", "T"));
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function PostsGrid({ block }: { block: Block }) {
  const resolved = block.items as PostCard[] | undefined;
  const perPage = typeof block.perPage === "number" ? block.perPage : 6;
  const cards: PostCard[] =
    resolved?.length
      ? resolved
      : recentPosts(perPage).map((p) => ({
          title: p.title,
          href: `/blog/${p.slug}/`,
          image: p.featuredImage,
          excerpt: p.excerpt,
          date: p.date,
        }));
  if (!cards.length) return null;

  // Elementor styles the card, its title, meta row and read-more link
  // separately; all of it is in the page CSS.
  const card = typography(block.style, /\.elementor-post$/);
  const text = typography(block.style, /__text/);
  const title = typography(block.style, /__title/);
  const meta = typography(block.style, /__meta-data/);
  const excerpt = typography(block.style, /__excerpt/);
  const more = typography(block.style, /__read-more/);
  const readMore = (block.readMore as string) || "Read More »";

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <article key={c.href} style={{ overflow: "hidden", ...card }}>
          {c.image && (
            <Link href={c.href} className="block">
              <div className="relative aspect-[3/2] overflow-hidden bg-mist">
                <Image
                  src={c.image}
                  alt=""
                  fill
                  sizes="380px"
                  className="object-cover"
                  unoptimized={!localSrc(c.image)}
                />
              </div>
            </Link>
          )}
          <div style={text}>
            <h3 className="elementor-post__title" style={title}>
              <Link href={c.href} style={title}>
                {c.title}
              </Link>
            </h3>
            {(formatPostDate(c.date) || resolved) && (
              <div className="elementor-post__meta-data mt-1 text-sm" style={meta}>
                {formatPostDate(c.date)}
                {formatPostDate(c.date) && <span className="mx-2">·</span>}
                No Comments
              </div>
            )}
            {c.excerpt && (
              <p className="elementor-post__excerpt mt-2" style={excerpt}>
                {c.excerpt}
              </p>
            )}
            <Link href={c.href} className="elementor-post__read-more mt-2 inline-block font-bold" style={more}>
              {readMore}
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

/**
 * Font Awesome brand marks, drawn from the same self-hosted webfont the footer
 * uses. Cross-origin font loads fail without CORS headers and the glyphs render
 * as nothing, with no console error — hence the local copy.
 */
function SocialIcons({ block }: { block: Block }) {
  const icons = (block.icons as { name?: string; link?: string }[] | undefined) ?? [];
  if (!icons.length) return null;
  const align = block.style?.[".elementor-widget-container"]?.["text-align"];
  const colour = pick(block.style, "color", /social-icon i/);
  return (
    <div style={{ textAlign: (align as CSSProperties["textAlign"]) ?? "center" }}>
      {icons.map((i, n) => {
        // "fab fa-facebook-f" -> "Facebook F", used as the accessible name.
        const label = (i.name || "")
          .replace(/^fab\s+fa-/, "")
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        return (
          <a
            key={i.link ?? n}
            href={i.link ?? "#"}
            className="mx-2 inline-block"
            style={{ color: colour }}
            target="_blank"
            rel="noopener noreferrer"
          >
            <i className={i.name} aria-hidden="true" />
            <span className="sr-only">{label}</span>
          </a>
        );
      })}
    </div>
  );
}

/**
 * Elementor's sitemap widget, which lists every published page. Rebuilt from
 * the nav rather than left blank — /sitemap/ is a published page whose entire
 * content is this one widget.
 */
function SiteMap() {
  const pages = sitemapPages();
  return (
    <div className="elementor-sitemap-wrap">
      <h2 className="mb-4 font-display text-2xl font-bold text-navy">Pages</h2>
      <ul className="columns-1 gap-8 sm:columns-2 lg:columns-4">
        {pages.map((p) => (
          <li key={p.path} className="mb-1 break-inside-avoid list-disc">
            <Link href={p.path} className="text-navy/80 hover:underline">
              {p.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Widget({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      return <Heading block={block} />;
    case "text-editor":
      return <TextEditor block={block} />;
    case "image":
      return <ImageWidget block={block} />;
    case "button":
      return <ButtonWidget block={block} />;
    case "icon-box":
      return <IconBoxWidget block={block} />;
    case "icon-list":
      return <IconList block={block} />;
    case "spacer":
      return <Spacer block={block} />;
    case "divider":
      return <Divider />;
    case "testimonial-carousel":
      return (
        <TestimonialCarousel
          items={(block.slides ?? []) as { quote: string; name: string; detail?: string; image?: string }[]}
          quoteStyle={typography(block.style, /__text/)}
          nameStyle={typography(block.style, /__name/)}
          detailStyle={typography(block.style, /__title/)}
        />
      );
    case "image-carousel":
    case "media-carousel":
      return (
        <ImageCarousel
          images={((block.images ?? []) as string[]).map((src) => ({ src }))}
          perView={Number(block.slidesPerView) || 3}
          thumb={block.thumbSize === "thumbnail"}
          autoplay={block.autoplay !== false}
          autoplaySpeed={Number(block.autoplaySpeed) || 5000}
          speed={Number(block.speed) || 500}
          infinite={block.infinite !== false}
          pauseOnHover={block.pauseOnHover !== false}
          navigation={(block.navigation as string) || "both"}
        />
      );
    case "gallery":
      return <Gallery images={((block.images ?? []) as string[]).map((src) => ({ src }))} />;
    case "video":
      return <VideoEmbed src={block.url as string} />;
    case "form":
      return (
        <WordPressForm
          name={(block.formName as string) ?? "form"}
          fields={(block.fields ?? []) as FormField[]}
          submitWidth={block.submitWidth as string | undefined}
          submitLabel={(block.submit as string) ?? "Submit"}
          source={(block.formName as string) ?? "page"}
        />
      );
    case "image-box":
      return (
        <div className="text-center">
          {block.src ? (
            <Image
              src={block.src as string}
              alt=""
              width={400}
              height={300}
              className="mx-auto h-auto w-full max-w-[400px]"
              unoptimized={!localSrc(block.src as string)}
            />
          ) : null}
          <h3 className="mt-4 font-display text-xl font-bold text-navy">{block.title as string}</h3>
          <p className="mt-2 text-navy">{block.description as string}</p>
        </div>
      );
    case "posts":
      return <PostsGrid block={block} />;
    // Instagram and Facebook feeds are third-party embeds with no static
    // equivalent — they need the official embed script or a build-time fetch of
    // the feed. Render nothing rather than a broken placeholder.
    case "shortcode":
    case "sbi-widget":
      return null;
    case "sitemap":
      return <SiteMap />;
    case "social-icons":
      return <SocialIcons block={block} />;
    case "countdown":
      return null;
    default:
      return null;
  }
}

export default function Blocks({ blocks }: { blocks: Block[] }): ReactNode {
  return (
    <>
      {blocks.map((b, i) => {
        if (b.type === "section" || b.type === "container") {
          return <SectionBlock key={b.id ?? i} block={b} />;
        }
        if (b.type === "column") {
          return <ColumnBlock key={b.id ?? i} block={b} />;
        }
        // Elementor wraps every widget in .elementor-widget-container and puts
        // the widget's own spacing there. Applying it here rather than in each
        // component means no widget can quietly lose its padding — without it
        // the home page's audience cards came out 51px short.
        const container = b.style?.["> .elementor-widget-container"] ?? {};
        const hide = ((b.hide as string[] | null) ?? []).map((h) => `e-hide-${h}`).join(" ");
        return (
          <div
            key={b.id ?? i}
            data-el={b.id}
            className={`w-full ${hide}`.trim()}
            style={{ padding: container.padding, margin: container.margin }}
          >
            <Widget block={b} />
          </div>
        );
      })}
    </>
  );
}
