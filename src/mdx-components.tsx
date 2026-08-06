import type { MDXComponents } from "mdx/types";
import Figure from "@/components/ui/Figure";
import Gallery from "@/components/ui/Gallery";
import ImageCarousel from "@/components/ui/ImageCarousel";
import VideoEmbed from "@/components/ui/VideoEmbed";

/**
 * Components available to every blog MDX file. The converter in
 * scripts/convert_posts.py emits <Figure>, <Gallery> and <VideoEmbed>.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    Figure,
    Gallery,
    ImageCarousel,
    VideoEmbed,
    h2: (props) => (
      <h2 className="mt-10 mb-3 font-display text-3xl font-semibold text-green-dark" {...props} />
    ),
    h3: (props) => (
      <h3 className="mt-8 mb-2 font-display text-2xl font-semibold text-green-dark" {...props} />
    ),
    p: (props) => <p className="my-4 leading-relaxed text-navy/90" {...props} />,
    a: (props) => (
      <a className="text-green-mid underline underline-offset-2 hover:text-green" {...props} />
    ),
    ul: (props) => <ul className="my-4 list-disc pl-6" {...props} />,
    ol: (props) => <ol className="my-4 list-decimal pl-6" {...props} />,
    ...components,
  };
}
