import Image from "next/image";

export type GalleryImage = { src: string; alt?: string };

/**
 * Photo grid. The blog archive is mostly runs of images pasted one after
 * another, so the MDX converter collapses those runs into this.
 */
export default function Gallery({
  images,
  srcs,
  alts,
  columns = 3,
}: {
  images?: GalleryImage[];
  /**
   * Pipe-separated paths, used by the blog MDX. Expression attributes
   * (`images={[...]}`) are silently dropped by the MDX runtime here, so the
   * converter emits plain string attributes instead.
   */
  srcs?: string;
  alts?: string;
  columns?: 2 | 3 | 4;
}) {
  if (!images?.length && srcs) {
    const a = (alts ?? "").split("|");
    images = srcs
      .split("|")
      .filter(Boolean)
      .map((src, i) => ({ src, alt: a[i] ?? "" }));
  }
  if (!images?.length) return null;

  const cols = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  }[columns];

  return (
    <div className={`my-8 grid grid-cols-1 gap-3 ${cols}`}>
      {images.map((img, i) => (
        <div
          key={`${img.src}-${i}`}
          className="relative aspect-4/3 overflow-hidden rounded-lg bg-mist"
        >
          <Image
            src={img.src}
            alt={img.alt ?? ""}
            fill
            sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 hover:scale-105"
            unoptimized={/^https?:\/\//.test(img.src)}
          />
        </div>
      ))}
    </div>
  );
}
