#!/usr/bin/env python3
"""Convert exported WordPress posts into MDX files.

The blog is overwhelmingly photo-diary content (1,284 <img> against 122 <p>), so
runs of images collapse into a <Gallery> rather than becoming a wall of loose
<Image> tags. Anything this script cannot represent is reported at the end
instead of being silently dropped.
"""
import html
import json
import pathlib
import re
from collections import Counter
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "src/content/blog"
SIZE_SUFFIX = re.compile(r"-\d+x\d+(?=\.[A-Za-z]+$)")
# The blog links images on both irishlifeexperience.com and its sister site
# irishway.org. Most of the sister-site URLs already 404 on the live web, but a
# good share of the same files exist in this site's own uploads, so they get
# rewritten locally and only the genuinely absent ones stay remote.
UPLOADS = re.compile(
    r"^(?:https?://(?:www\.)?(?:irishway\.org|irishlifeexperience\.com))?/wp-content/uploads/"
)

# Two media sources: this site's own uploads, and the files rescued from the
# irishway.org server (which the blog hot-links). The rescued files often sit at
# a different path than the post references, so a basename index backs up the
# exact-path lookup.
_SOURCES = [("export/uploads", ""), ("export/iw_uploads", "iw/")]
_LOCAL: dict[str, str] = {}
_BY_NAME: dict[str, str] = {}
for _dir, _prefix in _SOURCES:
    base = ROOT / _dir
    if not base.exists():
        continue
    for p in base.rglob("*"):
        if not p.is_file():
            continue
        rel = _prefix + str(p.relative_to(base))
        _LOCAL.setdefault(str(p.relative_to(base)), rel)
        _BY_NAME.setdefault(SIZE_SUFFIX.sub("", p.name), rel)

UNRESOLVED: Counter = Counter()
RECOVERED: Counter = Counter()


def featured(value):
    """featured_image is {'id','url','alt'} in this export, a bare URL in older
    ones. Returns (url, alt)."""
    if isinstance(value, dict):
        return value.get("url") or "", value.get("alt") or ""
    return value or "", ""


def to_asset(url: str) -> str:
    """Map a WordPress upload URL to a local /images path when the file exists."""
    url = html.unescape(url or "").strip()
    if not UPLOADS.search(url):
        return url
    rel = SIZE_SUFFIX.sub("", UPLOADS.sub("", url))
    if rel in _LOCAL:
        return "/images/" + _LOCAL[rel]
    name = rel.split("/")[-1]
    if name in _BY_NAME:
        RECOVERED[rel] += 1
        return "/images/" + _BY_NAME[name]
    UNRESOLVED[rel] += 1
    # Keep the gap visible rather than silent — but make it absolute. A
    # root-relative /wp-content/uploads/... would be treated as a local file and
    # 404 against our own domain; an absolute URL at least points at the origin
    # it came from and is handled as a remote image.
    return "https://irishway.org/wp-content/uploads/" + rel


def yaml_str(v: str) -> str:
    return json.dumps(v or "", ensure_ascii=False)


class Converter(HTMLParser):
    """Walk post HTML into an ordered list of blocks."""

    INLINE = {"em", "i", "strong", "b", "a", "span", "br", "small", "code"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks: list[dict] = []
        self.text: list[str] = []
        self.link: str | None = None
        self.dropped = Counter()
        self._skip = 0

    # -- helpers -------------------------------------------------------
    def _flush(self, kind="p"):
        body = "".join(self.text).strip()
        body = re.sub(r"\s+", " ", body)
        if body:
            self.blocks.append({"type": kind, "text": body})
        self.text = []

    def _add_image(self, src, alt):
        self.blocks.append({"type": "image", "src": src, "alt": alt or ""})

    # -- parser hooks --------------------------------------------------
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if self._skip:
            return
        if tag in ("script", "style", "noscript"):
            self._skip += 1
            self.dropped[tag] += 1
            return
        if tag == "img":
            # Prefer the full-size original behind the thumbnail link.
            src = self.link if (self.link and UPLOADS.search(self.link)) else a.get("src", "")
            self._add_image(to_asset(src), html.unescape(a.get("alt", "")))
            return
        if tag == "a":
            self.link = a.get("href", "")
            if not UPLOADS.search(self.link or ""):
                self.text.append("[")
            return
        if tag == "iframe":
            self._flush()
            self.blocks.append({"type": "video", "src": a.get("src", "")})
            return
        if tag in ("p", "div"):
            self._flush()
        elif tag in ("h1", "h2", "h3", "h4"):
            self._flush()
            self.text.append(f"__H{tag[1]}__")
        elif tag == "br":
            self.text.append(" ")
        elif tag in ("em", "i"):
            self.text.append("_")
        elif tag in ("strong", "b"):
            self.text.append("**")
        elif tag == "li":
            self._flush()
            self.text.append("- ")
        elif tag not in self.INLINE and tag not in ("ul", "ol", "figure", "figcaption"):
            self.dropped[tag] += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript"):
            self._skip = max(0, self._skip - 1)
            return
        if self._skip:
            return
        if tag == "a":
            if self.link and not UPLOADS.search(self.link):
                self.text.append(f"]({self.link})")
            self.link = None
        elif tag in ("em", "i"):
            self.text.append("_")
        elif tag in ("strong", "b"):
            self.text.append("**")
        elif tag in ("p", "div", "li", "h1", "h2", "h3", "h4"):
            self._flush()

    def handle_data(self, data):
        if self._skip:
            return
        # MDX treats < and { as syntax. The posts use "<<Noll-ag hunna ditch>>"
        # for pronunciation and {…} for Gaelic glosses, both of which MDX would
        # try to parse as JSX/expressions.
        #
        # Backslash escapes, not HTML entities: `&#123;` decodes back to `{`
        # before MDX parses expressions, so it still breaks the build.
        data = data.replace("\\", "\\\\")
        data = data.replace("<", "\\<").replace("{", "\\{").replace("}", "\\}")
        self.text.append(data)

    def close(self):
        super().close()
        self._flush()
        return self.blocks


def render(blocks: list[dict]) -> str:
    """Render blocks to MDX, collapsing image runs into galleries."""
    out, i = [], 0
    while i < len(blocks):
        b = blocks[i]
        if b["type"] == "image":
            run = []
            while i < len(blocks) and blocks[i]["type"] == "image":
                run.append(blocks[i])
                i += 1
            if len(run) == 1:
                out.append(f'<Figure src={yaml_str(run[0]["src"])} alt={yaml_str(run[0]["alt"])} />')
            else:
                # Plain string attributes, not a JSX expression: the MDX runtime
                # silently drops `images={[...]}` (the component then renders
                # nothing), while string attributes work. Pipe-separated because
                # no filename or alt text in this corpus contains one.
                srcs = "|".join(r["src"] for r in run)
                alts = "|".join((r["alt"] or "").replace("|", "/").replace('"', "'") for r in run)
                out.append(f"<Gallery srcs={yaml_str(srcs)} alts={yaml_str(alts)} />")
            continue
        if b["type"] == "video":
            out.append(f'<VideoEmbed src={yaml_str(b["src"])} />')
        else:
            t = b["text"]
            m = re.match(r"__H(\d)__\s*(.*)", t)
            out.append(f"{'#' * int(m.group(1))} {m.group(2)}" if m else t)
        i += 1
    return "\n\n".join(out).strip() + "\n"


def main():
    all_posts = [p for p in json.loads((ROOT / "export/posts.json").read_text())
                 if p["status"] == "publish"]

    # Password-protected posts are 'publish' but the live site gates them behind
    # a password form — the export still carries their full plaintext. Rendering
    # them to MDX would publish content the source site deliberately withheld
    # (here: the 2009-2012 student photo diary, largely about minors). Excluded
    # unless someone consciously decides otherwise.
    posts = [p for p in all_posts if not p.get("password_protected")]
    gated = [p for p in all_posts if p.get("password_protected")]

    OUT.mkdir(parents=True, exist_ok=True)
    dropped, elementor, empty = Counter(), [], []

    for p in posts:
        c = Converter()
        c.feed(p["content_raw"] or "")
        blocks = c.close()
        dropped.update(c.dropped)
        body = render(blocks)

        if p["built_with_elementor"]:
            elementor.append(p["slug"])
        if not body.strip():
            empty.append(p["slug"])

        seo = p["seo"] if isinstance(p["seo"], dict) else {}
        fm = [
            "---",
            f'title: {yaml_str(p["title"])}',
            f'slug: {yaml_str(p["slug"])}',
            f'date: {yaml_str(p["date"])}',
            f'author: {yaml_str(p["author"])}',
        ]
        if p["excerpt"]:
            fm.append(f'excerpt: {yaml_str(p["excerpt"])}')
        fi_url, fi_alt = featured(p["featured_image"])
        if fi_url:
            fm.append(f"featuredImage: {yaml_str(to_asset(fi_url))}")
            if fi_alt:
                fm.append(f"featuredImageAlt: {yaml_str(fi_alt)}")
        if p.get("categories"):
            fm.append("categories: [" + ", ".join(yaml_str(c) for c in p["categories"]) + "]")
        if p.get("tags"):
            fm.append("tags: [" + ", ".join(yaml_str(t) for t in p["tags"]) + "]")
        if seo.get("metadesc"):
            fm.append(f'description: {yaml_str(seo["metadesc"])}')
        if p["built_with_elementor"]:
            fm.append("needsReview: true  # built in Elementor; layout not captured here")
        fm.append("---")

        (OUT / f'{p["slug"]}.mdx').write_text("\n".join(fm) + "\n\n" + body)

    print(f"wrote {len(posts)} MDX files to {OUT.relative_to(ROOT)}")
    if gated:
        years = Counter(p["date"][:4] for p in gated)
        print(f"\nEXCLUDED {len(gated)} password-protected posts (of {len(all_posts)} published).")
        print(f"  by year: {dict(sorted(years.items()))}")
        print("  These are gated behind a password on the live site. Publishing them")
        print("  statically would expose content the source site withholds. Migrating")
        print("  them needs an explicit decision, not a default.")
    print(f"\nElementor-built posts needing manual layout review: {len(elementor)}")
    for s in elementor[:10]:
        print(f"   /{s}")
    if len(elementor) > 10:
        print(f"   ... and {len(elementor) - 10} more (flagged needsReview in frontmatter)")
    print(f"\nposts with empty bodies: {len(empty)}")
    for s in empty[:10]:
        print(f"   /{s}")
    print(f"\ntags dropped during conversion: {dict(dropped.most_common(10)) or 'none'}")
    if RECOVERED:
        print(f"\nimages resolved by filename from the irishway.org server rescue: "
              f"{len(RECOVERED)} unique ({sum(RECOVERED.values())} references)")
    if UNRESOLVED:
        print(f"\nimages referenced but not available locally: "
              f"{len(UNRESOLVED)} unique ({sum(UNRESOLVED.values())} references)")
        print("  these stay as absolute URLs. They already 404 on the live site and are")
        print("  absent from both the irishlifeexperience.com and irishway.org servers —")
        print("  the originals appear to be lost. The Internet Archive is the only")
        print("  remaining recovery route.")
        years = Counter(k.split("/")[0] for k in UNRESOLVED)
        print("  by year:", dict(sorted(years.items())))


if __name__ == "__main__":
    main()
