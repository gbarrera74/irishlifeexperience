/**
 * Responsive video embed.
 *
 * The WordPress content embeds YouTube over plain http:// on the old-style
 * youtube.com/v/ and /embed/ paths. This normalises any of those to a modern
 * https youtube-nocookie embed, so no insecure requests and no tracking cookie
 * before the visitor presses play.
 */
function toEmbedUrl(src: string): string | null {
  if (!src) return null;
  const url = src.startsWith("//") ? `https:${src}` : src.replace(/^http:/, "https:");

  const id =
    url.match(/[?&]v=([\w-]{6,})/)?.[1] ??
    url.match(/youtu\.be\/([\w-]{6,})/)?.[1] ??
    url.match(/youtube(?:-nocookie)?\.com\/(?:embed|v)\/([\w-]{6,})/)?.[1];

  if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
  if (/vimeo\.com\/(\d+)/.test(url)) {
    return `https://player.vimeo.com/video/${url.match(/vimeo\.com\/(\d+)/)![1]}`;
  }
  return url.startsWith("https://") ? url : null;
}

export default function VideoEmbed({
  src,
  title = "Embedded video",
}: {
  src: string;
  title?: string;
}) {
  const embed = toEmbedUrl(src);
  if (!embed) return null;

  return (
    <div className="my-8 aspect-video w-full overflow-hidden rounded-lg bg-black">
      <iframe
        src={embed}
        title={title}
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="h-full w-full"
      />
    </div>
  );
}
