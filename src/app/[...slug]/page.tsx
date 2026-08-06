import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Blocks from "@/components/Blocks";
import { allPages, getPage, segments } from "@/lib/pages";

/**
 * Serves every migrated WordPress page at its original URL, including the
 * nested ones (/students/classes/, /parents/faq/). Content comes from
 * src/content/pages/*.json, produced by scripts/extract_pages.py.
 */

type Params = { slug: string[] };

export function generateStaticParams(): Params[] {
  return allPages().map((p) => ({ slug: segments(p.path) }));
}

function findBySegments(slug: string[]) {
  const wanted = "/" + slug.join("/") + "/";
  const entry = allPages().find((p) => p.path === wanted);
  return entry ? getPage(entry.slug) : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = findBySegments(slug);
  if (!page) return {};
  return {
    title: page.seo?.title || page.title,
    description: page.seo?.metadesc,
    alternates: { canonical: page.path },
  };
}

export default async function WordPressPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const page = findBySegments(slug);
  if (!page) notFound();

  return (
    <>
      {page.css && <style>{page.css}</style>}
      <Blocks blocks={page.blocks} />
    </>
  );
}
