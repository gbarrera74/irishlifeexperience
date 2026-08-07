"use client";

import { useState } from "react";

/**
 * Click-to-play video embed, matching what the source page does.
 *
 * The original does not drop a bare iframe on the page either: Elementor renders
 * a poster with a play button and swaps in `…/embed/<id>?autoplay=1` when it is
 * clicked. Reproducing that fixes a real fault as well as matching the original —
 * the previous `loading="lazy"` iframe never issued a network request at all, so
 * the video simply never appeared.
 *
 * The embed host stays youtube-nocookie: no tracking cookie is set until the
 * visitor actually presses play.
 */
function youtubeId(src: string): string | null {
  if (!src) return null;
  const url = src.startsWith("//") ? `https:${src}` : src.replace(/^http:/, "https:");
  return (
    url.match(/[?&]v=([\w-]{6,})/)?.[1] ??
    url.match(/youtu\.be\/([\w-]{6,})/)?.[1] ??
    url.match(/youtube(?:-nocookie)?\.com\/(?:embed|v)\/([\w-]{6,})/)?.[1] ??
    null
  );
}

function vimeoId(src: string): string | null {
  return src.match(/vimeo\.com\/(\d+)/)?.[1] ?? null;
}

export default function VideoEmbed({
  src,
  title = "Embedded video",
}: {
  src: string;
  title?: string;
}) {
  const [playing, setPlaying] = useState(false);

  const yt = youtubeId(src);
  const vimeo = yt ? null : vimeoId(src);
  if (!yt && !vimeo) return null;

  const embed = yt
    ? `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1`
    : `https://player.vimeo.com/video/${vimeo}?autoplay=1`;

  return (
    <div className="my-8 aspect-video w-full overflow-hidden rounded-lg bg-black">
      {playing ? (
        <iframe
          src={embed}
          title={title}
          allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Play video: ${title}`}
          className="group relative block h-full w-full cursor-pointer"
        >
          {yt && (
            /* YouTube's own poster, which is what the original loads too.
               Not next/image: the host is remote and the file is already sized. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`https://i.ytimg.com/vi/${yt}/maxresdefault.jpg`}
              alt=""
              className="h-full w-full object-cover"
            />
          )}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-[68px] w-[100px] items-center justify-center rounded-[14px] bg-black/70 transition group-hover:bg-[#f00]">
              <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="#fff">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
