#!/usr/bin/env python3
"""Convert the WordPress Redirection plugin export into a Next.js redirects module.

The source host is read from export/site.json, so this is not tied to one site.

Chains are collapsed. The Redirection plugin happily stores A->B and B->C; left
alone that costs two hops per request and search engines discount the second.
Each destination is followed to its terminal target before being emitted.
"""
import json
import pathlib
from collections import Counter
from urllib.parse import urlparse

ROOT = pathlib.Path(__file__).resolve().parent.parent
rules = json.loads((ROOT / "export/redirects.json").read_text())
site = json.loads((ROOT / "export/site.json").read_text())

SITE_HOST = urlparse(site["home"]).netloc.lower()
BARE = SITE_HOST.replace("www.", "")
SELF_HOSTS = {"", BARE, "www." + BARE}


def norm_source(u: str) -> str:
    u = urlparse(u).path or u
    if not u.startswith("/"):
        u = "/" + u
    return u.rstrip("/") or "/"


def norm_dest(d: str) -> str:
    p = urlparse(d)
    if p.netloc.lower() not in SELF_HOSTS:
        return d  # keep cross-domain destinations absolute
    # Keep the trailing slash: next.config sets trailingSlash: true, so a
    # slashless destination would cost a second redirect hop.
    path = (p.path or "/").rstrip("/") + "/"
    return path + (f"?{p.query}" if p.query else "")


seen, out, skipped = set(), [], []
for r in rules:
    if r["status"] != "enabled":
        skipped.append((r["url"], "disabled"))
        continue
    if str(r["regex"]) not in ("0", "None", ""):
        skipped.append((r["url"], "regex rule — needs review"))
        continue
    src, dst = norm_source(r["url"]), norm_dest(r["action_data"] or "")
    if not dst:
        skipped.append((src, "no destination"))
        continue
    if src == dst:
        skipped.append((src, "self-referential"))
        continue
    if src in seen:
        skipped.append((src, "duplicate source"))
        continue
    seen.add(src)
    out.append({"source": src, "destination": dst, "permanent": r["action_code"] == "301"})

# --- collapse chains -------------------------------------------------------
# A destination that is itself a source means two hops. Follow to the end.
by_source = {r["source"]: r for r in out}
collapsed, loops = 0, []
for r in out:
    hops, dest, path = 0, r["destination"], [r["source"]]
    while dest.startswith("/") and dest.rstrip("/") in by_source and hops < 20:
        nxt = by_source[dest.rstrip("/")]["destination"]
        if dest in path:
            loops.append(r["source"])
            break
        path.append(dest)
        dest, hops = nxt, hops + 1
    if hops:
        r["destination"] = dest
        collapsed += 1

body = ",\n".join(
    f'  {{ source: {json.dumps(r["source"])}, destination: {json.dumps(r["destination"])}, '
    f'permanent: {"true" if r["permanent"] else "false"} }}'
    for r in out
)
target = ROOT / "src/redirects.ts"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(
    "// Generated from the WordPress Redirection plugin export by scripts/gen_redirects.py.\n"
    "// Do not edit by hand — re-run the script instead.\n"
    f"// {len(out)} rules migrated from {SITE_HOST}.\n\n"
    "import type { Redirect } from 'next/dist/lib/load-custom-routes'\n\n"
    f"const redirects: Redirect[] = [\n{body},\n]\n\nexport default redirects\n"
)

print(f"wrote {target.relative_to(ROOT)}: {len(out)} redirects from {len(rules)} source rules")
print(f"collapsed {collapsed} multi-hop chains to single hops")
if loops:
    print(f"REDIRECT LOOPS ({len(loops)}): {loops}")
print(f"skipped {len(skipped)}:")
for why, n in Counter(w for _, w in skipped).most_common():
    print(f"   {n:>3}  {why}")
print(f"cross-domain (kept absolute): {sum(1 for r in out if r['destination'].startswith('http'))}")

# Anything pointing at a path we do not publish will 404 after the redirect.
pages = json.loads((ROOT / "export/pages.json").read_text())
posts = json.loads((ROOT / "export/posts.json").read_text())
live = {urlparse(p["permalink"]).path for p in pages + posts if p["status"] == "publish"}
dangling = [r for r in out
            if r["destination"].startswith("/") and r["destination"].split("?")[0] not in live]
print(f"destinations not matching a published page/post: {len(dangling)}")
for r in dangling[:20]:
    print(f"   {r['source']}  ->  {r['destination']}")
