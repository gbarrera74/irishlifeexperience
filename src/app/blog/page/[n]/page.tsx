import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BlogList, { pageCount } from "@/components/BlogList";

/** WordPress paginated the blog at /blog/page/2/, /blog/page/3/, … */

export function generateStaticParams() {
  // Page 1 is /blog/ itself, so the numbered routes start at 2.
  return Array.from({ length: pageCount() - 1 }, (_, i) => ({ n: String(i + 2) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ n: string }>;
}): Promise<Metadata> {
  const { n } = await params;
  return {
    title: `Blog — page ${n}`,
    alternates: { canonical: `/blog/page/${n}/` },
    robots: { index: false, follow: true },
  };
}

export default async function BlogPage({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  const page = Number(n);
  if (!Number.isInteger(page) || page < 2 || page > pageCount()) notFound();
  return <BlogList page={page} />;
}
