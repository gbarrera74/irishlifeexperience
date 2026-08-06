import Image from "next/image";

/**
 * A single content image. Blog posts carry no width/height (WordPress inlined
 * them at arbitrary sizes), so the default is a fixed-ratio box; callers that
 * know the real dimensions can pass them and get intrinsic sizing instead.
 */
export default function Figure({
  src,
  alt = "",
  caption,
  width,
  height,
  ratio = "aspect-3/2",
  className = "",
}: {
  src: string;
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
  ratio?: string;
  className?: string;
}) {
  const remote = /^https?:\/\//.test(src);

  return (
    <figure className={`my-8 ${className}`}>
      {width && height ? (
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          className="h-auto w-full rounded-lg object-cover"
          unoptimized={remote}
        />
      ) : (
        <div className={`relative w-full overflow-hidden rounded-lg ${ratio}`}>
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(min-width: 1024px) 800px, 100vw"
            className="object-cover"
            unoptimized={remote}
          />
        </div>
      )}
      {caption && (
        <figcaption className="mt-2 text-center text-sm text-navy/70">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
