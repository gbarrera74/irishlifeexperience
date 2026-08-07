#!/usr/bin/env python3
"""Structural inventory diff of every rebuilt page against its live capture.

The word-level diff in scripts/fidelity.py cannot see a missing logo, an image
rendered at the wrong size, a dead video or a form that lost its fields — every
one of those scores 100% on text. This counts the *things* on each page instead:

  images, videos, iframes, forms and their fields, links, headings

and separately checks that every local asset a page references actually exists
on disk, and that every font family it names is self-hosted.

Reference is export/html/<slug>.html, the clean origin capture. Ours is fetched
from a running `next start`.

    python3 scripts/inventory.py [--base http://localhost:3000] [slug ...]
"""

from __future__ import annotations

import argparse
import html as htmllib
import json
import pathlib
import re
import subprocess
import sys
from collections import Counter

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

DROP = re.compile(r"<(script|style|noscript|template)[^>]*>.*?</\1>", re.S | re.I)


def strip_chrome(markup: str) -> str:
    """Main content only: header, footer, nav and Elementor popups removed.

    The header and footer are identical on every page and are captured verbatim
    elsewhere, so counting them would mask real per-page differences.
    """
    s = DROP.sub(" ", markup)
    s = re.sub(r'<div[^>]*data-elementor-type="popup".*?$', " ", s, flags=re.S | re.I)
    m = re.search(r"<main\b.*?</main>", s, re.S | re.I)
    if not m:
        m = re.search(r"<body\b.*?</body>", s, re.S | re.I)
    s = m.group() if m else s
    for tag in ("header", "footer", "nav"):
        s = re.sub(rf"<{tag}\b.*?</{tag}>", " ", s, flags=re.S | re.I)
    # Reader comments are deliberately not migrated.
    s = re.sub(r'<section[^>]*id="comments".*?</section>', " ", s, flags=re.S | re.I)
    return s


# Slides both sides clone to fake an infinite loop. Elementor's Swiper marks
# them swiper-slide-duplicate; ours carries data-clone.
CLONE = re.compile(r'swiper-slide-duplicate|data-clone=', re.I)


def drop_clones(markup: str) -> str:
    """Remove the duplicated slides both sides render for a looping carousel."""
    return re.sub(r'<(li|div)[^>]*(?:swiper-slide-duplicate|data-clone=)[^>]*>.*?</\1>',
                  ' ', markup, flags=re.S | re.I)


def real_images(markup: str) -> int:
    """<img> tags that stand for a real picture.

    NitroPack swaps the live site's sources for inline SVG placeholders and adds
    its own spacer gifs, so counting raw tags overstates the original. Anything
    whose only source is a data: URI with no lazy attribute pointing elsewhere is
    a placeholder, not a picture.
    """
    n = 0
    for tag in re.findall(r"<img\b[^>]*>", markup, re.I):
        # Section background images. Elementor paints these with CSS
        # background-image and emits no <img> at all, so counting ours would
        # show a surplus on every page that has one.
        if re.search(r'data-bg=', tag, re.I):
            continue
        lazy = re.search(r'(?:data-src|data-lazy-src|nitro-og-src|data-nitro-src)=["\']([^"\']+)', tag, re.I)
        src = re.search(r'\ssrc=["\']([^"\']+)', tag, re.I)
        target = (lazy.group(1) if lazy else (src.group(1) if src else ""))
        if not target:
            continue
        if target.startswith("data:") and not lazy:
            continue
        n += 1
    # Elementor's gallery paints each thumbnail as a CSS background on a div
    # rather than emitting an <img>, so a gallery reads as zero images on the
    # original while ours renders a real one per photo.
    n += len(re.findall(r"<div[^>]*data-thumbnail=", markup, re.I))
    return n


def inventory(markup: str) -> dict:
    body = drop_clones(strip_chrome(markup))
    # Hidden inputs, and our honeypot — an off-screen text input with
    # tabindex="-1" that exists to catch bots and has no counterpart on the
    # original. Counting it reported every form page as having one field too many.
    visible = [f for f in re.findall(r"<input\b[^>]*>", body, re.I)
               if not re.search(r'type=["\']hidden', f, re.I)
               and not re.search(r'tabindex=["\']-1', f, re.I)]
    return {
        "images": real_images(body),
        "iframes": len(re.findall(r"<iframe\b", body, re.I)),
        "videos": len(re.findall(r"<video\b", body, re.I)),
        "forms": len(re.findall(r"<form\b", body, re.I)),
        "fields": len(visible) + len(re.findall(r"<(select|textarea)\b", body, re.I)),
        "headings": len(re.findall(r"<h[1-4]\b", body, re.I)),
        "links": len(set(re.findall(r'<a\b[^>]*href=["\']([^"\'#]+)', body, re.I))),
    }


def fetch(url: str) -> str | None:
    r = subprocess.run(["curl", "-sS", "--max-time", "60", "-A", UA, url],
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return r.stdout.decode("utf8", "replace") if r.returncode == 0 else None


def local_asset_problems(markup: str) -> list[str]:
    """Local /images and /fonts references that do not exist on disk.

    Next embeds an escaped copy of the tree in its RSC payload, so the same
    paths appear a second time as \\"/images/…\\". Matching those raw captured a
    trailing backslash and reported every asset on every page as broken.
    """
    bad = []
    text = markup.replace("\\/", "/").replace('\\"', '"')
    for ref in set(re.findall(r'["\'(](/(?:images|fonts)/[^"\')\s\\]+)', text)):
        path = PUBLIC / htmllib.unescape(ref).lstrip("/").split("?")[0]
        if not path.is_file():
            bad.append(ref)
    return sorted(bad)


def remote_refs(markup: str) -> list[str]:
    """Assets still pointing at the WordPress origin."""
    return sorted(set(re.findall(
        r'https?://(?:www\.)?(?:irishlifeexperience\.com|irishway\.org)/wp-content/[^"\')\s]+',
        markup)))


GENERIC = re.compile(
    r"(?i)^(sans-serif|serif|monospace|cursive|fantasy|inherit|initial|unset|"
    r"var\(|-apple-system|system-ui|BlinkMac|Segoe|Helvetica|Arial|Noto|"
    r"Apple Color|ui-|emoji|&)")


def fonts_named(markup: str) -> set[str]:
    """Families the page asks for, excluding generics and the system stack."""
    out = set()
    text = htmllib.unescape(markup.replace('\\"', '"'))
    # Bounded: an unterminated match runs straight out of the declaration and
    # into page copy, which then reads as a set of absurd "font families".
    for decl in re.findall(r"font-family:\s*([^;}<\n]{1,120}?)(?=[;}<\n])", text):
        for part in decl.split(","):
            name = part.strip().strip("'\"").strip()
            if name and not GENERIC.match(name):
                out.add(name)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:3000")
    ap.add_argument("--posts", action="store_true")
    ap.add_argument("slugs", nargs="*")
    args = ap.parse_args()

    items = [p for p in json.loads((ROOT / "export/pages.json").read_text())
             if p["status"] == "publish"]
    if args.posts:
        items += [p for p in json.loads((ROOT / "export/posts.json").read_text())
                  if p["status"] == "publish" and not p.get("password_protected")]
    if args.slugs:
        items = [p for p in items if p["slug"] in set(args.slugs)]

    hosted = set()
    fonts_css = ROOT / "src/app/fonts.css"
    if fonts_css.exists():
        hosted = {m.strip().strip("'\"") for m in re.findall(r"font-family:\s*([^;}]+)", fonts_css.read_text())}

    rows, skipped = [], []
    totals = Counter()
    for p in items:
        slug = p["slug"]
        ref_path = ROOT / f"export/html/{slug}.html"
        if not ref_path.exists():
            continue
        ref = ref_path.read_text(errors="replace")
        if re.search(r"<title>[^<]*(404|Page not found)", ref, re.I):
            continue
        path = re.sub(r"^https?://[^/]+", "", p["permalink"])
        ours = fetch(args.base + path)
        if ours is None or "<html" not in ours.lower():
            skipped.append((path, "not served"))
            continue

        live_inv, our_inv = inventory(ref), inventory(ours)
        diffs = {k: (live_inv[k], our_inv[k]) for k in live_inv
                 if live_inv[k] != our_inv[k]}
        # Body only: Next's RSC payload repeats every path, and React keys like
        # "/images/a.jpg-45" live in there too — scanning it reported those as
        # broken files.
        broken = local_asset_problems(strip_chrome(ours))
        remote = remote_refs(ours)
        missing_fonts = sorted(f for f in fonts_named(ours) if f not in hosted)

        for k in diffs:
            totals[k] += 1
        if broken:
            totals["broken-assets"] += 1
        if remote:
            totals["remote-assets"] += 1
        if missing_fonts:
            totals["unhosted-fonts"] += 1

        if diffs or broken or remote or missing_fonts:
            rows.append((path, diffs, broken, remote, missing_fonts))

    print(f"checked {len(items)} pages against their live captures\n")

    clean = len(items) - len(rows) - len(skipped)
    print(f"identical inventory: {clean}")
    print(f"with differences:    {len(rows)}")
    if skipped:
        print(f"not served:          {len(skipped)}  {[s[0] for s in skipped]}")
    print(f"\nby kind: {dict(totals) or 'none'}\n")

    for path, diffs, broken, remote, fonts in sorted(rows, key=lambda r: -len(r[1])):
        parts = [f"{k}: live {a} / ours {b}" for k, (a, b) in diffs.items()]
        print(f"{path}")
        for x in parts:
            print(f"    {x}")
        if broken:
            print(f"    BROKEN ASSETS ({len(broken)}): {broken[:4]}")
        if remote:
            print(f"    REMOTE ASSETS ({len(remote)}): {remote[:3]}")
        if fonts:
            print(f"    UNHOSTED FONTS: {fonts}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
