#!/usr/bin/env python3
"""Regenerate everything derived from export/, in the order the steps require.

The steps are not independent, and running them out of order fails quietly
rather than loudly: extract_pages.py rewrites the page JSON with the original
WordPress image URLs, and only localize_page_images.py turns those into local
paths. Re-running the extractor on its own therefore leaves a site that builds
and renders but pulls every image from the live server — which is exactly what
happened while adding shape dividers, and nothing failed to say so.

    python3 scripts/build_content.py
"""

from __future__ import annotations

import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Order matters. Each entry is (script, why it must come after the previous one).
STEPS = [
    ("extract_pages.py", "reads export/, writes page and blog-post block trees"),
    ("localize_page_images.py", "rewrites the URLs extract_pages.py just emitted"),
    ("convert_posts.py", "reads export/, writes blog MDX"),
    ("localize_blog_images.py", "copies the files convert_posts.py referenced"),
]


def main() -> int:
    failed = []
    for script, why in STEPS:
        print(f"\n=== {script} — {why}")
        r = subprocess.run([sys.executable, str(ROOT / "scripts" / script)], cwd=ROOT)
        if r.returncode != 0:
            failed.append(script)
            print(f"!!! {script} exited {r.returncode}; later steps depend on it")
            break

    if failed:
        print(f"\nFAILED: {failed}")
        return 1

    print("\nContent regenerated. Now run `npm run build`, then:")
    print("  python3 scripts/fidelity.py --posts     word-level text retention")
    print("  python3 scripts/inventory.py            structural diff vs the live capture")
    return 0


if __name__ == "__main__":
    sys.exit(main())
