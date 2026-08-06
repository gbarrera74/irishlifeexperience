import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Blocks from "@/components/Blocks";
import { getPage } from "@/lib/pages";

/**
 * The home page renders from its Elementor block tree like every other page,
 * rather than being hand-built. Hand-building it costs rounds of corrections
 * and the result cannot be checked against the original mechanically.
 */

export function generateMetadata(): Metadata {
  const page = getPage("home");
  return {
    title: page?.seo?.title || page?.title,
    description: page?.seo?.description,
    alternates: { canonical: "/" },
  };
}

export default function Home() {
  const page = getPage("home");
  if (!page) notFound();
  return (
    <>
      {page.css && <style>{page.css}</style>}
      <Blocks blocks={page.blocks} />
    </>
  );
}
