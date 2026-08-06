import Image from "next/image";
import Link from "next/link";
import Section from "@/components/ui/Section";
import { allPosts } from "@/lib/posts";

/**
 * The blog index, matching the Elementor posts widget on /blog/: 12 per page,
 * "Read More »", numbered pagination with previous/next.
 */

export const PER_PAGE = 12;

export function pageCount() {
  return Math.max(1, Math.ceil(allPosts().length / PER_PAGE));
}

function formatDate(raw: string) {
  if (!raw) return "";
  const d = new Date(raw.replace(" ", "T"));
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function href(n: number) {
  return n <= 1 ? "/blog/" : `/blog/page/${n}/`;
}

export default function BlogList({ page }: { page: number }) {
  const posts = allPosts();
  const total = pageCount();
  const current = Math.min(Math.max(1, page), total);
  const slice = posts.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  // Elementor caps the number of page links it shows at pagination_page_limit.
  const LIMIT = 5;
  let from = Math.max(1, current - Math.floor(LIMIT / 2));
  const to = Math.min(total, from + LIMIT - 1);
  from = Math.max(1, to - LIMIT + 1);
  const numbers = Array.from({ length: to - from + 1 }, (_, i) => from + i);

  return (
    <Section>
      <h1 className="text-center font-display text-4xl font-bold text-navy md:text-[48px]">
        Blog
      </h1>

      <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {slice.map((p) => (
          <article key={p.slug}>
            <Link href={`/blog/${p.slug}/`} className="block">
              {p.featuredImage && (
                <div className="relative mb-3 aspect-[3/2] overflow-hidden rounded-lg bg-mist">
                  <Image
                    src={p.featuredImage}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
              )}
              <h2 className="font-display text-xl font-bold text-navy">{p.title}</h2>
            </Link>
            <p className="mt-1 text-sm text-muted">
              {formatDate(p.date)}
              <span className="mx-2">·</span>
              No Comments
            </p>
            {p.excerpt && <p className="mt-2 text-navy/80">{p.excerpt}</p>}
            <Link
              href={`/blog/${p.slug}/`}
              className="mt-2 inline-block text-sm font-bold text-green-mid hover:underline"
            >
              Read More »
            </Link>
          </article>
        ))}
      </div>

      {total > 1 && (
        <nav className="mt-12 flex flex-wrap items-center justify-center gap-3" aria-label="Blog pages">
          {current > 1 && (
            <Link href={href(current - 1)} className="text-green-mid hover:underline">
              « Previous
            </Link>
          )}
          {numbers.map((n) =>
            n === current ? (
              <span key={n} className="font-bold text-navy" aria-current="page">
                {n}
              </span>
            ) : (
              <Link key={n} href={href(n)} className="text-green-mid hover:underline">
                {n}
              </Link>
            ),
          )}
          {current < total && (
            <Link href={href(current + 1)} className="text-green-mid hover:underline">
              Next »
            </Link>
          )}
        </nav>
      )}
    </Section>
  );
}
