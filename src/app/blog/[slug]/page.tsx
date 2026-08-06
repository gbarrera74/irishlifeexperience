import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import Link from "next/link";
import Section from "@/components/ui/Section";
import Figure from "@/components/ui/Figure";
import Gallery from "@/components/ui/Gallery";
import VideoEmbed from "@/components/ui/VideoEmbed";
import { allPosts, getPost } from "@/lib/posts";
import Blocks from "@/components/Blocks";
import { getBlogPage } from "@/lib/pages";

/** Blog posts keep their WordPress URLs: /blog/<slug>/ */

const components = {
  Figure,
  Gallery,
  VideoEmbed,
  h2: (p: React.ComponentProps<"h2">) => (
    <h2 className="mt-10 mb-3 font-display text-3xl font-bold text-navy" {...p} />
  ),
  h3: (p: React.ComponentProps<"h3">) => (
    <h3 className="mt-8 mb-2 font-display text-2xl font-bold text-navy" {...p} />
  ),
  p: (p: React.ComponentProps<"p">) => <p className="my-4 leading-relaxed text-navy" {...p} />,
  a: (p: React.ComponentProps<"a">) => (
    <a className="text-green-mid underline underline-offset-2 hover:text-accent" {...p} />
  ),
  ul: (p: React.ComponentProps<"ul">) => <ul className="my-4 list-disc pl-6" {...p} />,
};

export function generateStaticParams() {
  return allPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}/` },
    openGraph: post.featuredImage ? { images: [post.featuredImage] } : undefined,
  };
}

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  // Elementor-built posts render from their block tree, which keeps the images
  // and layout. Classic posts render from MDX.
  const blockTree = getBlogPage(slug);

  const date = post.date
    ? new Date(post.date.replace(" ", "T")).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <Section>
      <article className={blockTree ? "" : "mx-auto max-w-3xl"}>
        <header className={blockTree ? "mx-auto mb-8 max-w-3xl" : "mb-8"}>
          <h1 className="font-display text-4xl font-bold text-navy">{post.title}</h1>
          <p className="mt-3 text-sm text-muted">
            {date}
            {post.author ? ` · ${post.author}` : ""}
          </p>
          {post.categories.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {post.categories.map((c) => (
                <li key={c} className="rounded-full bg-mist px-3 py-1 text-xs text-navy">
                  {c}
                </li>
              ))}
            </ul>
          )}
        </header>

        {blockTree ? (
          <>
            {blockTree.css && <style>{blockTree.css}</style>}
            <Blocks blocks={blockTree.blocks} />
          </>
        ) : (
          <MDXRemote source={post.body} components={components} />
        )}

        <p className="mx-auto mt-12 max-w-3xl">
          <Link href="/blog/" className="text-green-mid underline underline-offset-2">
            ← All posts
          </Link>
        </p>
      </article>
    </Section>
  );
}
