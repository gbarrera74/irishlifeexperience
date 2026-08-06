#!/usr/bin/env python3
"""Verify every migrated redirect resolves in one hop to a real page.

Two failure modes this catches:
  * multi-hop chains — A 308s to B which 308s to C. Search engines discount the
    second hop and it doubles latency.
  * redirects that land on a 404, which is worse than not redirecting at all.

Run against `next start`:
    python3 scripts/check_redirects.py [--base http://localhost:3000]
"""
import argparse
import http.client
import json
import pathlib
import re
import sys
from collections import Counter
from urllib.parse import urlparse

ROOT = pathlib.Path(__file__).resolve().parent.parent


def parse_redirects():
    src = (ROOT / "src/redirects.ts").read_text()
    return re.findall(
        r'\{\s*source:\s*"([^"]+)",\s*destination:\s*"([^"]+)"', src)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:3000")
    args = ap.parse_args()
    base = urlparse(args.base)

    rules = parse_redirects()
    print(f"{len(rules)} redirects in src/redirects.ts")

    conn = http.client.HTTPConnection(base.hostname, base.port or 80, timeout=30)
    stats = Counter()
    problems = []

    for source, destination in rules:
        # Request the canonical trailing-slash form. next.config sets
        # trailingSlash: true, so a slashless request is normalised first and
        # would always show one extra hop — an artefact of the URL shape being
        # tested, not of the rule. The Redirection plugin's own source URLs
        # carry the slash, so this is the shape real traffic arrives in.
        start = source if source.endswith("/") else source + "/"
        chain, url, hops = [], start, 0
        status = None
        try:
            while hops < 6:
                conn.request("HEAD", url, headers={"Host": base.netloc})
                r = conn.getresponse()
                status = r.status
                loc = r.getheader("Location")
                r.read()
                if status in (301, 302, 307, 308) and loc:
                    chain.append(loc)
                    url = urlparse(loc).path or loc
                    hops += 1
                    continue
                break
        except Exception as e:  # noqa: BLE001
            problems.append((source, destination, f"error: {e}"))
            stats["error"] += 1
            continue

        if hops == 0:
            problems.append((source, destination, f"no redirect (HTTP {status})"))
            stats["not-redirected"] += 1
        elif hops > 1:
            problems.append((source, destination, f"{hops} hops: {' -> '.join(chain)}"))
            stats["multi-hop"] += 1
        elif status and status >= 400:
            problems.append((source, destination, f"lands on HTTP {status}"))
            stats["dead-target"] += 1
        else:
            stats["ok"] += 1

    conn.close()
    print(f"\nsingle-hop to a live page: {stats['ok']}/{len(rules)}")
    for k in ("multi-hop", "dead-target", "not-redirected", "error"):
        if stats[k]:
            print(f"  {k}: {stats[k]}")

    if problems:
        print(f"\n{len(problems)} to look at:")
        for s, d, why in problems[:40]:
            print(f"   {s}  ->  {d}\n      {why}")
        if len(problems) > 40:
            print(f"   ... and {len(problems) - 40} more")
    return 0


if __name__ == "__main__":
    sys.exit(main())
