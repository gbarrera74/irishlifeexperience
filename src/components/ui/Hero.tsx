import Image from "next/image";
import type { ReactNode } from "react";

export default function Hero({
  title,
  eyebrow,
  image,
  imageAlt = "",
  children,
  height = "min-h-[520px]",
  priority = false,
}: {
  title: string;
  eyebrow?: string;
  image?: string;
  imageAlt?: string;
  children?: ReactNode;
  height?: string;
  priority?: boolean;
}) {
  return (
    <section
      className={`relative flex ${height} items-center justify-center overflow-hidden ${
        image ? "" : "bg-green-dark"
      }`}
    >
      {image && (
        <>
          <Image
            src={image}
            alt={imageAlt}
            fill
            priority={priority}
            sizes="100vw"
            className="object-cover"
            unoptimized={/^https?:\/\//.test(image)}
          />
          <div className="absolute inset-0 bg-black/[0.34]" aria-hidden="true" />
        </>
      )}

      <div className="relative mx-auto max-w-[1200px] px-5 py-20 text-center text-white">
        <h1 className="font-display text-4xl font-medium drop-shadow-sm md:text-6xl">
          {title}
        </h1>
        {eyebrow && <p className="eyebrow mt-4 text-sm md:text-base">{eyebrow}</p>}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}
