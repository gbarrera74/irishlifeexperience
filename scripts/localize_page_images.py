#!/usr/bin/env python3
"""Copy every image the pages reference into public/images/wp/ and rewrite the
page JSON to point at the local copies.

Originals are camera-sized; they are downscaled on the way in. Anything that
cannot be found locally is left as an absolute URL and reported, so gaps stay
visible instead of turning into silent 404s.
"""
import json
import pathlib
import re
import subprocess
from collections import Counter

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES = ROOT / "src/content/pages"
DEST = ROOT / "public/images/wp"
SOURCES = [ROOT / "export/uploads", ROOT / "export/ile_uploads"]
# WordPress resize suffix, optionally followed by a re-upload counter:
#   foo-820x547.jpg  /  foo-820x547-1.jpg  /  foo-1.jpg
SIZE = re.compile(r"(?:-\d+x\d+)?(?:-\d+)?(?=\.[A-Za-z]+$)")
UPLOAD = re.compile(r"https?://(?:[\w-]+\.)*(?:irishway\.org|irishlifeexperience\.com)/wp-content/uploads/([^\"'\s)]+)")
MAX_DIM = "1600"

index: dict[str, pathlib.Path] = {}
by_name: dict[str, pathlib.Path] = {}
by_stem: dict[str, pathlib.Path] = {}  # extension-agnostic: .jpg re-saved as .jpeg
for base in SOURCES:
    if not base.exists():
        continue
    for p in base.rglob("*"):
        if p.is_file():
            index.setdefault(str(p.relative_to(base)), p)
            clean = SIZE.sub("", p.name)
            by_name.setdefault(clean, p)
            by_stem.setdefault(clean.rsplit(".", 1)[0].lower(), p)

copied, missing = Counter(), Counter()


def localize(url: str) -> str:
    m = UPLOAD.match(url or "")
    if not m:
        return url
    rel = SIZE.sub("", m.group(1))
    name = rel.split("/")[-1]
    src = index.get(rel) or by_name.get(name) or by_stem.get(name.rsplit(".", 1)[0].lower())
    if src and src.suffix.lower() != pathlib.Path(rel).suffix.lower():
        rel = rel.rsplit(".", 1)[0] + src.suffix  # keep the extension we actually have
    if not src:
        missing[rel] += 1
        return url
    out = DEST / rel
    if not out.exists():
        out.parent.mkdir(parents=True, exist_ok=True)
        # sips downscales in place; fall back to a plain copy for odd formats
        r = subprocess.run(["sips", "-Z", MAX_DIM, str(src), "--out", str(out)],
                           capture_output=True)
        if r.returncode != 0 or not out.exists():
            out.write_bytes(src.read_bytes())
    copied[rel] += 1
    return "/images/wp/" + rel


def walk(node):
    if isinstance(node, dict):
        return {k: (localize(v) if isinstance(v, str) and UPLOAD.match(v) else walk(v))
                for k, v in node.items()}
    if isinstance(node, list):
        return [walk(v) for v in node]
    if isinstance(node, str) and UPLOAD.search(node):
        # inline HTML (text-editor bodies) can embed upload URLs too
        return UPLOAD.sub(lambda m: localize(m.group(0)), node)
    return node


def main():
    # Elementor-built blog posts are rendered from block trees too, so their
    # images need localising by the same pass.
    for d in (PAGES, ROOT / "src/content/blogpages"):
        for f in sorted(d.glob("*.json")):
            if f.name.startswith("_"):
                continue
            doc = json.loads(f.read_text())
            f.write_text(json.dumps(walk(doc), indent=1, ensure_ascii=False))

    print(f"localized {len(copied)} unique images into {DEST.relative_to(ROOT)}")
    if missing:
        print(f"not found locally: {len(missing)} unique ({sum(missing.values())} refs)")
        for rel, n in missing.most_common(10):
            print(f"   {n}x  {rel}")


if __name__ == "__main__":
    main()
