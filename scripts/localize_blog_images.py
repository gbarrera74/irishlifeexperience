#!/usr/bin/env python3
"""Copy the images the blog MDX references into public/images/.

scripts/convert_posts.py rewrites upload URLs to /images/<path> (this site's own
uploads) and /images/ile/<path> (files rescued from the irishlifeexperience.com
server). This copies the actual files to those locations, downscaled.

Anything still missing is reported — those are the pre-2015 archive images that
are absent from both servers.
"""
import pathlib
import re
import subprocess
from collections import Counter

ROOT = pathlib.Path(__file__).resolve().parent.parent
BLOG = ROOT / "src/content/blog"
DEST = ROOT / "public/images"
SRC_OWN = ROOT / "export/uploads"
SRC_ILE = ROOT / "export/ile_uploads"
MAX_DIM = "1600"

refs = set()
for f in BLOG.glob("*.mdx"):
    text = f.read_text(errors="replace")
    # <Figure src="/images/..."> and <Gallery srcs="/images/a|/images/b">
    for quoted in re.findall(r'"((?:/images/)[^"]*)"', text):
        refs.update(p for p in quoted.split("|") if p.startswith("/images/"))

copied, missing, skipped = Counter(), [], 0
for ref in sorted(refs):
    rel = ref[len("/images/"):]
    if rel.startswith("ile/"):
        src = SRC_ILE / rel[len("ile/"):]
    else:
        src = SRC_OWN / rel
    out = DEST / rel
    if out.exists():
        skipped += 1
        continue
    if not src.exists():
        missing.append(ref)
        continue
    out.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(["sips", "-Z", MAX_DIM, str(src), "--out", str(out)], capture_output=True)
    if r.returncode != 0 or not out.exists():
        out.write_bytes(src.read_bytes())
    copied[ref] += 1

print(f"blog image references: {len(refs)}")
print(f"  copied:        {len(copied)}")
print(f"  already there: {skipped}")
print(f"  missing:       {len(missing)}")
for m in missing[:10]:
    print(f"     {m}")
