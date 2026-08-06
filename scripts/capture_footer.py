#!/usr/bin/env python3
"""Capture the irishlifeexperience.com footer verbatim — markup and CSS.

The footer is reproduced exactly rather than rebuilt: the Elementor markup is
taken as-is and rendered with the same stylesheets the live site loads for it.
Only asset URLs are rewritten to local copies, and the form is rewired to our
own API by src/components/Footer.tsx.

Elementor's CSS is namespaced (`.elementor-622 .elementor-element-…`, `.e-con`,
`.elementor-widget-…`) so including it does not affect the rest of the site.

Outputs:
  src/content/footer.html   the markup
  src/app/footer.css        the stylesheets, concatenated, URLs localised
"""
import pathlib
import re
import subprocess
import urllib.request
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://irishlifeexperience.com"
UA = {"User-Agent": "Mozilla/5.0 (footer-capture)"}

# Only what the footer actually needs. Deliberately excludes the page/kit CSS
# that would restyle the rest of the site.
CSS_PARTS = [
    "/wp-content/plugins/elementor/assets/css/frontend.min.css",
    "/wp-content/plugins/elementor/assets/css/widget-heading.min.css",
    "/wp-content/plugins/elementor/assets/css/widget-social-icons.min.css",
    "/wp-content/plugins/elementor/assets/css/widget-icon-list.min.css",
    "/wp-content/plugins/elementor/assets/css/widget-image.min.css",
    "/wp-content/plugins/elementor/assets/css/widget-spacer.min.css",
    "/wp-content/plugins/elementor-pro/assets/css/widget-form.min.css",
    "/wp-content/plugins/elementor/assets/lib/font-awesome/css/fontawesome.min.css",
    "/wp-content/plugins/elementor/assets/lib/font-awesome/css/brands.min.css",
]

# Matches absolute and root-relative upload URLs. Root-relative matters because
# the host gets stripped from links before assets are localised.
UPLOAD = re.compile(
    r"(?:https?://(?:[\w-]+\.)*(?:irishway\.org|irishlifeexperience\.com))?/wp-content/uploads/([^\"'\s)]+)"
)
SIZE = re.compile(r"(?:-\d+x\d+)?(?:-\d+)?(?=\.[A-Za-z]+$)")

# Corrections applied to the captured markup. Kept explicit and reported on each
# run so they don't silently rot if the source is edited in WordPress.
CONTENT_FIXES = [
    ("Testimonals", "Testimonials"),  # misspelt in the WordPress footer menu
]


def fetch(url: str) -> str:
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read().decode("utf8", "replace")


class Extract(HTMLParser):
    """Grab the subtree of the element carrying data-elementor-type=footer."""

    VOID = {"br", "img", "input", "hr", "meta", "link", "source", "area", "base", "col", "embed", "param", "track", "wbr"}

    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.out: list[str] = []
        self.depth = 0
        self.on = False

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if not self.on and d.get("data-elementor-type") == "footer":
            self.on = True
            self.depth = 0
        if not self.on:
            return
        bits = "".join(
            f' {k}="{v}"' if v is not None else f" {k}" for k, v in attrs
        )
        self.out.append(f"<{tag}{bits}>")
        if tag not in self.VOID:
            self.depth += 1

    def handle_startendtag(self, tag, attrs):
        if not self.on:
            return
        bits = "".join(f' {k}="{v}"' if v is not None else f" {k}" for k, v in attrs)
        self.out.append(f"<{tag}{bits}/>")

    def handle_endtag(self, tag):
        if not self.on or tag in self.VOID:
            return
        self.out.append(f"</{tag}>")
        self.depth -= 1
        if self.depth == 0:
            self.on = False

    def handle_data(self, data):
        if self.on:
            self.out.append(data)

    def handle_entityref(self, name):
        if self.on:
            self.out.append(f"&{name};")

    def handle_charref(self, name):
        if self.on:
            self.out.append(f"&#{name};")


def localise(text: str) -> str:
    """Point upload URLs at our local copies, copying the file if needed."""
    dest_root = ROOT / "public/images/wp"
    sources = [ROOT / "export/uploads", ROOT / "export/ile_uploads"]

    def repl(m):
        rel = SIZE.sub("", m.group(1))
        name = rel.split("/")[-1]
        for base in sources:
            for cand in (base / rel, *(base.rglob(name) if not (base / rel).exists() else ())):
                if cand.is_file():
                    out = dest_root / rel
                    if not out.exists():
                        out.parent.mkdir(parents=True, exist_ok=True)
                        r = subprocess.run(["sips", "-Z", "1600", str(cand), "--out", str(out)], capture_output=True)
                        if r.returncode != 0 or not out.exists():
                            out.write_bytes(cand.read_bytes())
                    return "/images/wp/" + rel
        return m.group(0)

    return UPLOAD.sub(repl, text)


FONT_URL = re.compile(r"url\((['\"]?)(https?://[^)'\"]+\.(?:woff2|woff|ttf|eot|otf)[^)'\"]*)\1\)")


def self_host_fonts(css: str) -> str:
    """Download webfonts and serve them from /fonts/.

    Left pointing at irishway.org they fail: cross-origin font loads need CORS
    headers, which the origin does not send, so the Font Awesome brand glyphs
    (the social icons) silently render as nothing.
    """
    dest = ROOT / "public/fonts"
    dest.mkdir(parents=True, exist_ok=True)
    seen: dict[str, str] = {}

    def repl(m):
        url = m.group(2)
        clean = url.split("?")[0].split("#")[0]
        name = clean.rsplit("/", 1)[-1]
        if clean not in seen:
            out = dest / name
            if not out.exists():
                try:
                    req = urllib.request.Request(clean, headers=UA)
                    out.write_bytes(urllib.request.urlopen(req, timeout=40).read())
                    print(f"  font: {name} ({out.stat().st_size}b)")
                except Exception as e:
                    print(f"  font FAILED {name}: {e}")
                    return m.group(0)
            seen[clean] = "/fonts/" + name
        return f"url({seen[clean]})"

    return FONT_URL.sub(repl, css)


def main():
    # From the harvest, not the live site: NitroPack rewrites served markup.
    page = (ROOT / "export/html/about-us.html").read_text(errors="replace")
    ex = Extract()
    ex.feed(page)
    html = "".join(ex.out)
    if len(html) < 2000:
        raise SystemExit(f"footer looks truncated ({len(html)} bytes) — check the parser")

    # Cloudflare rewrites mailto links; restore the real address.
    def unmask(m):
        s = m.group(1)
        k = int(s[:2], 16)
        return "mailto:" + "".join(chr(int(s[i:i + 2], 16) ^ k) for i in range(2, len(s), 2))

    html = re.sub(r'/cdn-cgi/l/email-protection#([0-9a-f]+)', unmask, html)
    html = re.sub(r'<a[^>]*class="__cf_email__"[^>]*data-cfemail="([0-9a-f]+)"[^>]*>.*?</a>',
                  lambda m: unmask(m).replace("mailto:", ""), html, flags=re.S)
    html = re.sub(r'<span[^>]*class="__cf_email__"[^>]*data-cfemail="([0-9a-f]+)"[^>]*>.*?</span>',
                  lambda m: unmask(m).replace("mailto:", ""), html, flags=re.S)
    html = html.replace("https://irishlifeexperience.com/", "/")
    html = localise(html)

    # Deliberate content corrections to the captured markup.
    for wrong, right in CONTENT_FIXES:
        if wrong in html:
            html = html.replace(wrong, right)
            print(f"  fixed: {wrong!r} -> {right!r}")
        else:
            print(f"  NOTE: {wrong!r} no longer present — drop it from CONTENT_FIXES")

    out_html = ROOT / "src/content/footer.html"
    out_html.write_text(html)
    print(f"wrote {out_html.relative_to(ROOT)} ({len(html)} bytes)")

    css_parts = []
    for path in CSS_PARTS:
        try:
            css = fetch(SITE + path)
        except Exception as e:
            print(f"  skipped {path}: {e}")
            continue
        # font/asset URLs inside plugin CSS are relative to the file
        base = SITE + path.rsplit("/", 1)[0] + "/"
        css = re.sub(r'url\((["\']?)(?!data:|https?:|/)([^)"\']+)\1\)',
                     lambda m: f'url({base}{m.group(2)})', css)
        css_parts.append(f"/* {path} */\n{css}")
        print(f"  + {path.rsplit('/', 1)[-1]} ({len(css)}b)")

    # The footer CSS refers to --e-global-color-* variables that are declared in
    # the site kit (post-45.css). Pull just those declarations across — including
    # the whole kit would restyle the rest of the site — and hang them off :root
    # so they resolve without the .elementor-kit-45 class on <body>.
    css_parts.append("/* export/pagecss/_footer.css (post-622) */\n"
                     + (ROOT / "export/pagecss/_footer.css").read_text())
    print(f"  + _footer.css (post-622)")

    try:
        # The kit is post 6 (post-45 is the header template).
        kit = (ROOT / "export/pagecss/_kit.css").read_text()
        decls: list[str] = []
        for sel, body in re.findall(r"([^{}]+)\{([^{}]+)\}", kit):
            if "--e-global-" in body:
                decls += [d.strip() for d in body.split(";") if d.strip().startswith("--e-global-")]
        if decls:
            css_parts.insert(0, ":root{" + ";".join(dict.fromkeys(decls)) + "}")
            print(f"  + kit variables ({len(set(decls))} custom properties)")
    except Exception as e:
        print(f"  kit variables unavailable: {e}")

    css = localise("\n".join(css_parts))
    css = self_host_fonts(css)
    out_css = ROOT / "src/app/footer.css"
    out_css.write_text(css)
    print(f"wrote {out_css.relative_to(ROOT)} ({len(css)} bytes)")


if __name__ == "__main__":
    main()
