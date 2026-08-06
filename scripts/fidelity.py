#!/usr/bin/env python3
"""Word-level diff of each rendered page against the live original.

Reference is export/html/<slug>.html — the clean origin capture, not a live
fetch. Fetching live would come back through NitroPack, which rewrites the
markup, so the comparison would measure NitroPack rather than the rebuild.

Retention = how much of the original's visible text survives in ours, counted
as a multiset so repeated words are not double-credited:

    sum(min(ours[w], theirs[w])) / sum(theirs.values())

Run against a server started with `next start`:
    python3 scripts/fidelity.py [--base http://localhost:3000] [slug ...]
"""
import argparse
import html
import json
import pathlib
import re
import sys
import urllib.error
import urllib.request
from collections import Counter

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Chrome, because the WordPress capture was taken with one and some markup is
# user-agent dependent.
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"}

DROP_TAGS = re.compile(r"<(script|style|noscript|svg|template)[^>]*>.*?</\1>", re.S | re.I)
TAGS = re.compile(r"<[^>]+>")

# Chrome injects these; they are not page content.
BOILERPLATE = re.compile(
    r"Skip to content|This content is password-protected|"
    r"Enter your email|Your browser does not support",
    re.I)


def visible_text(markup: str) -> Counter:
    """Words inside the page's main content.

    Scope to <main> and stop there. Both sides put the site header and footer
    outside <main>, so narrowing to it drops the shared chrome that would
    otherwise float every score by a few hundred words.

    Do NOT strip <header> generally: a post's title sits in an <article>'s own
    <header> on our side and inside <main> on theirs, so stripping the tag
    scored short posts at 0% for a difference that does not exist.
    """
    s = DROP_TAGS.sub(" ", markup)
    # Elementor popups sit after the footer, outside <main>, but drop them first
    # in case a page has no <main> at all and we fall back to <body>.
    s = re.sub(r'<div[^>]*data-elementor-type="popup".*?$', " ", s, flags=re.S | re.I)

    m = re.search(r"<main\b.*?</main>", s, re.S | re.I)
    if not m:
        m = re.search(r"<body\b.*?</body>", s, re.S | re.I)
    s = m.group() if m else s

    # Any footer/nav that ended up nested inside main is still chrome.
    for tag in ("footer", "nav"):
        s = re.sub(rf"<{tag}\b.*?</{tag}>", " ", s, flags=re.S | re.I)

    # Reader comments are deliberately not migrated, so counting them as missing
    # content would flag a decision as a defect. WordPress renders them inside
    # <section id="comments">.
    s = re.sub(r'<section[^>]*id="comments".*?</section>', " ", s, flags=re.S | re.I)

    text = html.unescape(TAGS.sub(" ", s))
    text = BOILERPLATE.sub(" ", text)
    words = re.findall(r"[0-9A-Za-zÀ-ɏ']+", text.lower())
    return Counter(words)


def retention(ours: Counter, theirs: Counter) -> float:
    total = sum(theirs.values())
    if not total:
        return 1.0
    kept = sum(min(ours[w], n) for w, n in theirs.items())
    return kept / total


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    return urllib.request.urlopen(req, timeout=60).read().decode("utf8", "replace")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:3000")
    ap.add_argument("--posts", action="store_true", help="include blog posts")
    ap.add_argument("slugs", nargs="*")
    args = ap.parse_args()

    pages = [p for p in json.loads((ROOT / "export/pages.json").read_text())
             if p["status"] == "publish"]
    targets = [(p["slug"], re.sub(r"^https?://[^/]+", "", p["permalink"])) for p in pages]

    if args.posts:
        posts = [p for p in json.loads((ROOT / "export/posts.json").read_text())
                 if p["status"] == "publish" and not p.get("password_protected")]
        targets += [(p["slug"], re.sub(r"^https?://[^/]+", "", p["permalink"]))
                    for p in posts]

    if args.slugs:
        targets = [t for t in targets if t[0] in set(args.slugs)]

    rows, failed, no_ref = [], [], []
    for slug, path in targets:
        ref = ROOT / f"export/html/{slug}.html"
        if not ref.exists():
            continue
        raw = ref.read_text(errors="replace")
        # Four posts have a numeric slug that collides with WordPress's own
        # id-based URLs, so the live site 404s them even though they are
        # published. Scoring against a 404 page measures nothing.
        if re.search(r"<title>[^<]*(404|Page not found)", raw, re.I):
            no_ref.append((slug, path))
            continue
        theirs = visible_text(raw)
        try:
            ours = visible_text(fetch(args.base + path))
        except urllib.error.HTTPError as e:
            failed.append((slug, path, f"HTTP {e.code}"))
            continue
        except Exception as e:  # noqa: BLE001
            failed.append((slug, path, str(e)[:60]))
            continue
        rows.append((retention(ours, theirs), slug, path,
                     sum(theirs.values()), sum(ours.values()), ours, theirs))

    rows.sort()
    print(f"{'retention':>9}  {'live':>6} {'ours':>6}  page")
    for r, slug, path, nt, no, *_ in rows:
        flag = "   " if r >= 0.95 else ("  !" if r >= 0.80 else " !!")
        print(f"{r * 100:8.1f}%{flag} {nt:>6} {no:>6}  {path}")

    if rows:
        vals = sorted(r[0] for r in rows)
        median = vals[len(vals) // 2]
        print(f"\n{len(rows)} pages | median {median * 100:.1f}% | "
              f">=95%: {sum(1 for v in vals if v >= 0.95)} | "
              f"<80%: {sum(1 for v in vals if v < 0.80)}")

    if failed:
        print(f"\n{len(failed)} could not be fetched:")
        for slug, path, why in failed:
            print(f"   {path}  {why}")

    if no_ref:
        print(f"\n{len(no_ref)} have no reference — they 404 on the live site "
              f"despite being published (numeric slug); we serve them:")
        for slug, path in no_ref:
            print(f"   {path}")

    # What the worst pages are actually missing.
    for r, slug, path, nt, no, ours, theirs in rows[:5]:
        if r >= 0.95:
            break
        gap = Counter({w: n - ours[w] for w, n in theirs.items() if n > ours[w]})
        print(f"\n{path} ({r * 100:.0f}%) missing: "
              + ", ".join(f"{w}x{n}" if n > 1 else w for w, n in gap.most_common(18)))


if __name__ == "__main__":
    sys.exit(main())
