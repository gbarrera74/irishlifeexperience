import fs from "node:fs";
import path from "node:path";

export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  excerpt?: string;
  featuredImage?: string;
  categories?: string[];
};

const DIR = path.join(process.cwd(), "src/content/blog");

/** Minimal frontmatter reader — the files are generated, so the shape is known. */
function frontmatter(raw: string): Record<string, string> {
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      try {
        val = JSON.parse(val);
      } catch {
        val = val.slice(1, -1);
      }
    }
    out[key] = val;
  }
  return out;
}

let cache: PostMeta[] | null = null;

export function recentPosts(limit = 6): PostMeta[] {
  if (cache) return cache.slice(0, limit);
  if (!fs.existsSync(DIR)) return [];
  const posts = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => {
      const fm = frontmatter(fs.readFileSync(path.join(DIR, f), "utf8"));
      return {
        slug: fm.slug || f.replace(/\.mdx$/, ""),
        title: fm.title || f,
        date: fm.date || "",
        excerpt: fm.excerpt,
        featuredImage: fm.featuredImage,
      } satisfies PostMeta;
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  cache = posts;
  return posts.slice(0, limit);
}
