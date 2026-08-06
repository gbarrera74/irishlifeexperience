import fs from "node:fs";
import path from "node:path";

export type Post = {
  slug: string;
  title: string;
  date: string;
  author?: string;
  excerpt?: string;
  featuredImage?: string;
  categories: string[];
  needsReview: boolean;
  body: string;
};

const DIR = path.join(process.cwd(), "src/content/blog");

function parse(raw: string) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: {} as Record<string, string>, body: raw };
  const fm: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim().replace(/\s+#.*$/, "");
    if (v.startsWith('"')) {
      try { v = JSON.parse(v); } catch { v = v.replace(/^"|"$/g, ""); }
    }
    fm[k] = v;
  }
  return { fm, body: m[2] };
}

function list(k?: string) {
  if (!k) return [];
  const inner = k.replace(/^\[|\]$/g, "").trim();
  if (!inner) return [];
  return inner.split(/",\s*"/).map((s) => s.replace(/^"|"$/g, "")).filter(Boolean);
}

let cache: Post[] | null = null;

/** Parsed once per process — this runs for every one of the 344 static posts. */
export function allPosts(): Post[] {
  if (cache) return cache;
  if (!fs.existsSync(DIR)) return (cache = []);
  cache = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => {
      const { fm, body } = parse(fs.readFileSync(path.join(DIR, f), "utf8"));
      return {
        slug: fm.slug || f.replace(/\.mdx$/, ""),
        title: fm.title || f,
        date: fm.date || "",
        author: fm.author,
        excerpt: fm.excerpt,
        featuredImage: fm.featuredImage,
        categories: list(fm.categories),
        needsReview: Boolean(fm.needsReview),
        body,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return cache;
}

const bySlug = new Map<string, Post>();

export function getPost(slug: string): Post | undefined {
  if (!bySlug.size) for (const p of allPosts()) bySlug.set(p.slug, p);
  return bySlug.get(slug);
}
