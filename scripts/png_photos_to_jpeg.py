#!/usr/bin/env python3
"""Convert photographic PNGs to JPEG and rewrite every reference to them.

A large share of this media library is photographs that were saved as PNG —
several megabytes each for images displayed a few hundred pixels wide. PNG has
no lossy mode, so resizing alone barely helps; re-encoding as JPEG does.

Only converts files that are:
  * larger than MIN_BYTES, and
  * fully opaque (no alpha channel)

Anything with transparency is left alone — those are logos and badges that need
it. References are rewritten across src/ so nothing 404s.

Pass --dry-run to see what would change.
"""
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMAGES = ROOT / "public/images"
SEARCH = [ROOT / "src"]
MIN_BYTES = 300_000
QUALITY = "68"


def has_alpha(p: pathlib.Path) -> bool:
    """True only when transparency is actually used.

    `sips -g hasAlpha` reports the presence of an alpha *channel*, which most
    phone and screenshot exports carry even when every pixel is opaque — it
    flagged 67 of 70 files here, of which only 35 were really transparent.
    Reading the channel's extrema is the honest test.
    """
    try:
        from PIL import Image
    except ImportError:  # fall back to the conservative answer
        out = subprocess.run(["sips", "-g", "hasAlpha", str(p)], capture_output=True, text=True).stdout
        return "hasAlpha: yes" in out

    try:
        im = Image.open(p)
        if im.mode not in ("RGBA", "LA") and not (im.mode == "P" and "transparency" in im.info):
            return False
        low, _ = im.convert("RGBA").getchannel("A").getextrema()
        return low < 255
    except Exception:
        return True  # unreadable: leave it alone


def main():
    dry = "--dry-run" in sys.argv
    candidates = [
        p for p in IMAGES.rglob("*.png")
        if p.stat().st_size > MIN_BYTES and not has_alpha(p)
    ]
    skipped_alpha = [
        p for p in IMAGES.rglob("*.png")
        if p.stat().st_size > MIN_BYTES and has_alpha(p)
    ]

    print(f"opaque PNGs to convert: {len(candidates)} "
          f"({sum(p.stat().st_size for p in candidates) / 1e6:.1f} MB)")
    print(f"kept as PNG (transparency): {len(skipped_alpha)}")
    if dry:
        for p in candidates[:10]:
            print(f"   {p.stat().st_size / 1e6:5.1f} MB  {p.relative_to(IMAGES)}")
        return

    renames: dict[str, str] = {}
    saved = 0
    for p in candidates:
        jpg = p.with_suffix(".jpg")
        before = p.stat().st_size
        r = subprocess.run(
            ["sips", "-s", "format", "jpeg", "-s", "formatOptions", QUALITY, str(p), "--out", str(jpg)],
            capture_output=True,
        )
        if r.returncode != 0 or not jpg.exists():
            print(f"   FAILED {p.name}")
            continue
        saved += before - jpg.stat().st_size
        renames["/" + str(p.relative_to(ROOT / "public"))] = "/" + str(jpg.relative_to(ROOT / "public"))
        p.unlink()

    print(f"converted {len(renames)} files, saved {saved / 1e6:.1f} MB")

    # rewrite references
    touched = 0
    pattern = re.compile("|".join(re.escape(k) for k in renames)) if renames else None
    if pattern:
        for base in SEARCH:
            for f in base.rglob("*"):
                if not f.is_file() or f.suffix not in {".json", ".mdx", ".tsx", ".ts", ".html", ".css"}:
                    continue
                text = f.read_text(errors="replace")
                if not pattern.search(text):
                    continue
                f.write_text(pattern.sub(lambda m: renames[m.group(0)], text))
                touched += 1
    print(f"rewrote references in {touched} files")


if __name__ == "__main__":
    main()
