#!/usr/bin/env python3
"""Extract real glyph outlines from the Happy Icons webfont as SVG paths.

The old site drew its icon-box icons from Happy Elementor Addons' icon font.
Hand-drawing lookalikes does not match, so the actual outlines are pulled out
of the font and emitted as SVG path data on a 24x24 viewBox.

Usage: extract_happy_icons.py <happy-icons.woff2> <out.json> [css-url]
"""
import json
import re
import sys
import urllib.request

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

CSS_URL = (
    "https://irishway.org/wp-content/plugins/"
    "happy-elementor-addons/assets/fonts/style.min.css"
)
WANTED = ["hm-compass", "hm-direction-both", "hm-team-member", "hm-map-marker"]


def codepoints(css_src):
    """Map .hm-xxx class names to the codepoint their ::before content sets.

    Accepts a local path or a URL. Prefer a local copy — the live host is behind
    Cloudflare and 403s plain urllib requests.
    """
    if css_src.startswith("http"):
        css = urllib.request.urlopen(css_src).read().decode("utf8", "replace")
    else:
        with open(css_src, encoding="utf8", errors="replace") as fh:
            css = fh.read()
    out = {}
    for m in re.finditer(r"\.(hm-[\w-]+):before\s*\{\s*content:\s*[\"']\\([0-9a-fA-F]+)", css):
        out[m.group(1)] = int(m.group(2), 16)
    return out


def main():
    font_path, out_path = sys.argv[1], sys.argv[2]
    css_url = sys.argv[3] if len(sys.argv) > 3 else CSS_URL

    cps = codepoints(css_url)
    font = TTFont(font_path)
    cmap = font.getBestCmap()
    glyphs = font.getGlyphSet()
    upem = font["head"].unitsPerEm

    result = {}
    for name in WANTED:
        cp = cps.get(name)
        if cp is None:
            print(f"  {name}: no codepoint in CSS")
            continue
        gname = cmap.get(cp)
        if gname is None:
            print(f"  {name}: U+{cp:04X} not in font cmap")
            continue

        pen = SVGPathPen(glyphs)
        glyphs[gname].draw(pen)
        path = pen.getCommands()
        # Font coordinates are y-up from the baseline; SVG is y-down. Scale the
        # em square to 24 and flip, then shift down by the em box.
        scale = 24 / upem
        result[name] = {
            "path": path,
            "transform": f"matrix({scale} 0 0 {-scale} 0 24)",
            "codepoint": f"U+{cp:04X}",
        }
        print(f"  {name}: U+{cp:04X} -> {len(path)} chars of path data")

    with open(out_path, "w") as fh:
        json.dump(result, fh, indent=2)
    print(f"wrote {out_path} ({len(result)} glyphs)")


if __name__ == "__main__":
    main()
