import fs from "node:fs";
import path from "node:path";
import type { Block } from "@/components/Blocks";

export type PageDoc = {
  slug: string;
  title: string;
  path: string;
  seo: Record<string, string>;
  /** Elementor's @media rules, rewritten onto data-el attributes. */
  css?: string;
  blocks: Block[];
};

const DIR = path.join(process.cwd(), "src/content/pages");

export type PageIndexEntry = { slug: string; title: string; path: string };

/**
 * Pages deliberately not carried over. Each needs a decision, not a default.
 *
 * /payment/ collects a credit card number, expiry and security code in a plain
 * Elementor form. On the live site its submit_actions are unset, so Elementor
 * applies its defaults — email plus save-to-database — meaning a submission
 * would mail the card and CVV in cleartext and store them. It is published, in
 * the XML sitemap, and linked from nowhere. Rebuilding it would recreate a
 * PCI-DSS problem on a new domain; the URL is left to 404 until someone decides
 * what the page should be. Remove the entry to reinstate it.
 */
export const EXCLUDED_PAGES = new Set(["payment"]);

let pageCache: PageIndexEntry[] | null = null;

export function allPages(): PageIndexEntry[] {
  if (pageCache) return pageCache;
  const index = JSON.parse(
    fs.readFileSync(path.join(DIR, "_index.json"), "utf8"),
  ) as PageIndexEntry[];
  // "/" is served by app/page.tsx, so it must not also match the catch-all.
  pageCache = index.filter((p) => p.path !== "/" && !EXCLUDED_PAGES.has(p.slug));
  return pageCache;
}

/** Everything the sitemap widget lists: the home page plus every built page. */
export function sitemapPages(): PageIndexEntry[] {
  const index = JSON.parse(
    fs.readFileSync(path.join(DIR, "_index.json"), "utf8"),
  ) as PageIndexEntry[];
  return index.filter((p) => !EXCLUDED_PAGES.has(p.slug));
}

export function getPage(slug: string): PageDoc | null {
  const file = path.join(DIR, `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as PageDoc;
}

const BLOG_DIR = path.join(process.cwd(), "src/content/blogpages");

// Which slugs have a block tree — read once, not per page. Re-reading the
// directory for each of the ~290 static posts turns the build from seconds
// into minutes.
let blogPageSlugs: Set<string> | null = null;

function elementorPostSlugs(): Set<string> {
  if (blogPageSlugs) return blogPageSlugs;
  blogPageSlugs = fs.existsSync(BLOG_DIR)
    ? new Set(
        fs
          .readdirSync(BLOG_DIR)
          .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
          .map((f) => f.replace(/\.json$/, "")),
      )
    : new Set();
  return blogPageSlugs;
}

/**
 * Elementor-built posts keep their layout and images in a block tree; the MDX
 * body for those is only the flattened text. Returns null for classic posts,
 * which render from MDX instead.
 */
export function getBlogPage(slug: string): PageDoc | null {
  if (!elementorPostSlugs().has(slug)) return null;
  return JSON.parse(
    fs.readFileSync(path.join(BLOG_DIR, `${slug}.json`), "utf8"),
  ) as PageDoc;
}

/** "/parents/faq/" -> ["parents","faq"] */
export function segments(p: string): string[] {
  return p.split("/").filter(Boolean);
}
