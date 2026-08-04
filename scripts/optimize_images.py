#!/usr/bin/env python3
"""Downscale and re-compress everything in public/images, in place.

The originals are camera-sized: a 5 MB PNG for a photo displayed at 400px is
common in this media library. Filenames and extensions are left alone so no
content references need rewriting.

  * anything wider/taller than MAX_DIM is scaled down
  * JPEGs are re-encoded at QUALITY
  * PNGs are only resized — converting them to JPEG would change the extension
    and break references

Idempotent: run it again after adding images and only the new ones change much.
"""
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMAGES = ROOT / "public/images"
MAX_DIM = 1400
QUALITY = "65"


def dims(p: pathlib.Path):
    out = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(p)],
                         capture_output=True, text=True).stdout
    w = h = 0
    for line in out.splitlines():
        if "pixelWidth:" in line:
            w = int(line.split(":")[1])
        elif "pixelHeight:" in line:
            h = int(line.split(":")[1])
    return w, h


def main():
    dry = "--dry-run" in sys.argv
    files = sorted(p for p in IMAGES.rglob("*") if p.suffix.lower() in {".jpg", ".jpeg", ".png"})
    before = sum(p.stat().st_size for p in files)
    changed = 0

    for i, p in enumerate(files, 1):
        w, h = dims(p)
        args = ["sips"]
        if max(w, h) > MAX_DIM:
            args += ["-Z", str(MAX_DIM)]
        if p.suffix.lower() in {".jpg", ".jpeg"}:
            args += ["-s", "formatOptions", QUALITY]
        if len(args) == 1:
            continue
        if dry:
            changed += 1
            continue
        size_before = p.stat().st_size
        r = subprocess.run(args + [str(p)], capture_output=True)
        if r.returncode == 0 and p.stat().st_size < size_before:
            changed += 1
        if i % 150 == 0:
            print(f"  … {i}/{len(files)}")

    after = sum(p.stat().st_size for p in files)
    print(f"files: {len(files)}  touched: {changed}")
    print(f"before: {before / 1e6:.1f} MB   after: {after / 1e6:.1f} MB "
          f"({100 * (before - after) / before:.0f}% smaller)")


if __name__ == "__main__":
    main()
