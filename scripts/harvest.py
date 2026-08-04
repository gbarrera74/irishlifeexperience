#!/usr/bin/env python3
"""Harvest clean HTML and per-page Elementor CSS. Runs ON the source server.

  python3 harvest.py manifest.json /root/ile_harvest

Two things make this less trivial than "curl each page":

* **NitroPack rewrites the served HTML.** Stylesheets are replaced with combined
  bundles on cdn-*.nitrocdn.com, so `post-<id>.css` links disappear entirely —
  not just get reordered. `?nonitro=1` disables it per request.
* **Apache's vhosts bind the public IP, not `*`.** A Host-header request to
  127.0.0.1 gets the default vhost and 404s. Hit the public IP with -k instead.

Fetching also has a side effect we depend on: Elementor generates
`uploads/elementor/css/post-<id>.css` lazily, on first render. Most published
pages have no CSS file until something asks for them. So the fetch pass must
finish before the CSS pass copies anything.
"""
import json
import pathlib
import subprocess
import sys
import time

HOST = "irishlifeexperience.com"
ORIGIN = "https://104.131.115.77"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

CSS_DIR = pathlib.Path(
    "/var/www/webroot/irishlifeexperience.com/public_html"
    "/wp-content/uploads/elementor/css")

# Templates that every page pulls in, saved under fixed names. The kit is the
# important one: without post-6.css every var(--e-global-color-*) resolves to
# nothing and backgrounds render transparent.
SHARED = {6: "kit", 45: "header", 622: "footer", 3934: "popup"}


def fetch(path, dest, tries=4):
    """GET one page from the origin, bypassing NitroPack. Returns HTTP status."""
    sep = "&" if "?" in path else "?"
    url = f"{ORIGIN}{path}{sep}nonitro=1"
    for attempt in range(tries):
        # stdout=PIPE rather than capture_output: the source box runs Python 3.6.
        r = subprocess.run(
            ["curl", "-sSk", "--max-time", "60",
             "-H", f"Host: {HOST}",
             "-H", "Accept: text/html,application/xhtml+xml",
             "-H", "Accept-Language: en-US,en;q=0.9",
             "-A", UA, url, "-o", str(dest), "-w", "%{http_code}"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            universal_newlines=True)
        code = (r.stdout or "").strip()
        if code == "200":
            return code
        # ClickCease intermittently 403s; backing off clears it.
        time.sleep(2 * (attempt + 1))
    return code


def main():
    manifest = json.loads(pathlib.Path(sys.argv[1]).read_text())
    out = pathlib.Path(sys.argv[2])
    html_dir, css_dir = out / "html", out / "pagecss"
    for d in (html_dir, css_dir):
        d.mkdir(parents=True, exist_ok=True)

    failures = []
    print(f"fetching {len(manifest)} pages", flush=True)
    for i, item in enumerate(manifest, 1):
        dest = html_dir / f"{item['slug']}.html"
        code = fetch(item["path"], dest)
        size = dest.stat().st_size if dest.exists() else 0
        if code != "200" or size < 5000:
            failures.append((item["slug"], item["path"], code, size))
            print(f"  [{i}/{len(manifest)}] FAIL {code} {size}B {item['path']}", flush=True)
        elif i % 25 == 0:
            print(f"  [{i}/{len(manifest)}] ok", flush=True)

    # CSS only after every page has been rendered at least once.
    print("\ncollecting per-page CSS", flush=True)
    missing = []
    for item in manifest:
        src = CSS_DIR / f"post-{item['id']}.css"
        if src.exists() and src.stat().st_size > 0:
            (css_dir / f"{item['slug']}.css").write_bytes(src.read_bytes())
        else:
            missing.append(f"{item['slug']} (post-{item['id']})")

    for pid, name in SHARED.items():
        src = CSS_DIR / f"post-{pid}.css"
        if src.exists():
            (css_dir / f"_{name}.css").write_bytes(src.read_bytes())
            print(f"  _{name}.css  <- post-{pid}.css  ({src.stat().st_size}B)", flush=True)
        else:
            print(f"  _{name}.css  MISSING post-{pid}.css", flush=True)

    print(f"\nhtml: {len(list(html_dir.glob('*.html')))} files")
    print(f"css:  {len(list(css_dir.glob('*.css')))} files")
    if missing:
        print(f"\nno CSS generated for {len(missing)}:")
        for m in missing:
            print("   ", m)
    if failures:
        print(f"\n{len(failures)} fetch failures:")
        for f in failures:
            print("   ", f)


if __name__ == "__main__":
    main()
