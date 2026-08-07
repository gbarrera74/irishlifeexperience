#!/usr/bin/env python3
"""Self-host the webfonts the pages actually ask for.

The extracted CSS carries literal family names ("Nothing You Could Do",
"Open Sans Condensed", …) as inline styles. next/font registers its faces under
generated names, so those literals resolve to nothing and the text silently
falls back to a system face — the script headings across the site were rendering
in sans-serif while getComputedStyle still reported the family that was asked
for. document.fonts.check() is no help here: it returns true whenever *some*
fallback can paint the string.

Elementor already serves the right faces under the right names, so this mirrors
its google-fonts bundle locally and writes src/app/fonts.css.

    python3 scripts/capture_fonts.py
"""

from __future__ import annotations

import pathlib
import re
import subprocess
import sys
from collections import Counter

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://irishlifeexperience.com"
CSS_DIR = f"{SITE}/wp-content/uploads/elementor/google-fonts/css"
OUT_CSS = ROOT / "src/app/fonts.css"
FONT_DIR = ROOT / "public/fonts"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36"

# Family name -> Elementor's slug for it.
SLUGS = {
    "Open Sans": "opensans",
    "Quicksand": "quicksand",
    "Nothing You Could Do": "nothingyoucoulddo",
    "Dancing Script": "dancingscript",
    "Roboto": "roboto",
    "Oswald": "oswald",
    "Lato": "lato",
    "Dawning of a New Day": "dawningofanewday",
    # Google retired Open Sans Condensed; the live site 403s on it. Elementor
    # renders it with the regular Open Sans faces, so alias it rather than
    # leaving 35 references to fall back to a system font.
    "Open Sans Condensed": None,
}


def fetch(url: str) -> bytes | None:
    r = subprocess.run(["curl", "-sS", "--max-time", "60", "-A", UA, url],
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if r.returncode != 0 or not r.stdout or r.stdout.startswith(b"<"):
        return None
    return r.stdout


def families_used() -> Counter:
    used: Counter = Counter()
    for f in (ROOT / "export/pagecss").glob("*.css"):
        for decl in re.findall(r"font-family:([^;}]+)", f.read_text(errors="replace")):
            for part in decl.split(","):
                name = part.strip().strip('"\'')
                if name and not re.match(r"(?i)^(sans-serif|serif|monospace|cursive|var\()", name):
                    used[name] += 1
    return used


def main():
    used = families_used()
    print("families referenced in the page CSS:")
    for name, n in used.most_common():
        print(f"   {n:>4}  {name}")

    FONT_DIR.mkdir(parents=True, exist_ok=True)
    chunks, missing = [], []

    for family, count in used.most_common():
        if family not in SLUGS:
            missing.append(f"{family} (no mapping)")
            continue
        slug = SLUGS[family]
        if slug is None:
            continue  # handled as an alias below
        css = fetch(f"{CSS_DIR}/{slug}.css")
        if not css:
            missing.append(f"{family} (fetch failed)")
            continue
        text = css.decode("utf8", "replace")

        # Pull each referenced font file down and point the rule at it.
        for url in sorted(set(re.findall(r"url\((https?://[^)]+)\)", text))):
            name = url.rsplit("/", 1)[-1].split("?")[0]
            dest = FONT_DIR / name
            if not dest.exists():
                blob = fetch(url)
                if not blob:
                    missing.append(f"{family}: {name}")
                    continue
                dest.write_bytes(blob)
            text = text.replace(url, f"/fonts/{name}")

        chunks.append(f"/* {family} — {count} references */\n{text}")
        print(f"  + {family:<24} {len(text):>6}b")

    # Open Sans Condensed: same faces, condensed rendering. The source file is
    # taken from the Open Sans bundle we just wrote rather than hardcoded — a
    # guessed hash never resolves and the alias silently does nothing.
    if "Open Sans Condensed" in used:
        latin = ""
        for chunk in chunks:
            if chunk.startswith("/* Open Sans "):
                blocks = re.findall(r"/\* latin \*/\s*@font-face\s*\{[^}]*?url\((/fonts/[^)]+)\)", chunk)
                if blocks:
                    latin = blocks[-1]
                    break
        if latin:
            chunks.append(
                "/* Open Sans Condensed was retired by Google and 403s on the source\n"
                "   site; Elementor falls back to Open Sans for it. */\n"
                "@font-face{font-family:'Open Sans Condensed';font-style:normal;"
                "font-weight:300 800;font-stretch:75%;"
                f"src:url({latin}) format('woff2');}}\n"
            )
            print(f"  + Open Sans Condensed     aliased to {latin}")
        else:
            missing.append("Open Sans Condensed (no latin Open Sans face found)")

    OUT_CSS.write_text("\n".join(chunks))
    print(f"\nwrote {OUT_CSS.relative_to(ROOT)} ({OUT_CSS.stat().st_size}b)")
    print(f"font files in {FONT_DIR.relative_to(ROOT)}: {len(list(FONT_DIR.glob('*')))}")
    if missing:
        print(f"\nnot self-hosted ({len(missing)}):")
        for m in missing:
            print("   ", m)


if __name__ == "__main__":
    sys.exit(main())
