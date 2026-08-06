#!/usr/bin/env python3
"""Turn each exported Elementor page into a structured block tree for rendering.

Two sources are merged, because neither alone is sufficient:

  * `export/pages.json`  — the Elementor widget tree (content and structure).
    It only records settings an editor explicitly overrode.
  * `export/pagecss/<slug>.css` — the CSS Elementor generated for that page.
    This is where the real colours, sizes and backgrounds live, including
    everything inherited from the kit that never appears in the widget settings.

Writes src/content/pages/<slug>.json.
"""
import html
import json
import pathlib
import re
from collections import OrderedDict

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "src/content/pages"

# Elementor global colour ids -> hex, generated from export/kit.json.
GLOBALS = {
    "primary": "#6EC1E4", "secondary": "#54595F", "text": "#7A7A7A", "accent": "#61CE70",
    "fc41b48": "#FFFFFF", "1fa65d1": "", "6b1c049": "#000000", "27c3f38": "#002B00",
    "032e6ac": "#74B843", "5f9eadf": "#477C2A", "a60ae7e": "#E4978E", "baa86bb": "#F8DB6B",
    "2fa0566": "#D5E9F6", "c6ef796": "#F2F2F2", "f3735e1": "#1E3A43", "920946a": "#F4EFEB",
    "e481d42": "#F3C820",
}

STYLE_KEYS = (
    "color", "background-color", "font-size", "font-weight", "font-family",
    "text-align", "text-transform", "letter-spacing", "line-height",
    "border-radius", "padding", "margin", "max-width", "min-height", "opacity",
    # Layout properties. Leaving these out silently changed geometry: the home
    # page's card images carry `height:195px`, and without it they fell back to
    # their natural ratio and every card came out 15px short.
    "width", "height", "max-height", "object-fit", "font-style",
    "margin-top", "margin-bottom", "margin-left", "margin-right",
    "padding-top", "padding-bottom", "padding-left", "padding-right",
    "align-items", "align-content", "justify-content", "box-shadow",
    "border-width", "border-style", "border-color",
)


def resolve(value: str) -> str:
    """Swap var( --e-global-color-x ) for the hex it points at."""
    def sub(m):
        return GLOBALS.get(m.group(1), m.group(0))
    return re.sub(r"var\(\s*--e-global-color-([\w-]+)\s*\)", sub, value or "").strip()


def split_media(css: str):
    """(css outside any @media, [(query, block-body), ...]).

    Elementor writes desktop rules first and narrower breakpoints after. Parsing
    the file as one flat stream therefore lets the *mobile* declarations win at
    every width — the home page's audience cards were laid out with the
    max-width:767px rules on desktop, so they touched instead of sitting in a
    row with 20px gutters.
    """
    base, blocks, i = [], [], 0
    while True:
        m = re.compile(r"@media([^{]+)\{").search(css, i)
        if not m:
            base.append(css[i:])
            break
        base.append(css[i:m.start()])
        depth, j = 1, m.end()
        while j < len(css) and depth:
            if css[j] == "{":
                depth += 1
            elif css[j] == "}":
                depth -= 1
            j += 1
        blocks.append((m.group(1).strip(), css[m.end():j - 1]))
        i = j
    return "".join(base), blocks


def rules_for(css: str) -> dict:
    """element-id -> {sub-selector or '': {prop: value}} for one flat CSS chunk."""
    out: dict[str, dict] = {}
    for sel, body in re.findall(r"([^{}]+)\{([^{}]+)\}", css):
        for part in sel.split(","):
            m = re.search(r"elementor-element-([a-z0-9]+)", part)
            if not m:
                continue
            eid = m.group(1)
            # what comes after the element selector, e.g. " .elementor-heading-title"
            tail = part.split(f"elementor-element-{eid}", 1)[1].strip()
            props = {}
            for decl in body.split(";"):
                if ":" not in decl:
                    continue
                k, v = decl.split(":", 1)
                k = k.strip()
                if k in STYLE_KEYS:
                    props[k] = resolve(v)
            if props:
                out.setdefault(eid, {}).setdefault(tail, {}).update(props)
    return out


# Wrapper sub-selectors that describe the element's own box rather than a child.
SELF_TAILS = ("", "> .elementor-element-populated", "> .elementor-widget-container",
              "> .elementor-widget-wrap")


def responsive_css(blocks) -> str:
    """Re-emit the @media rules against our own markup.

    The rebuild does not reproduce Elementor's class names, so each rendered
    element carries data-el="<id>" and the breakpoints are rewritten onto that.
    """
    out = []
    for query, body in blocks:
        decls = []
        for eid, tails in rules_for(body).items():
            for tail, props in tails.items():
                # !important is required, not sloppiness: the base styles are
                # applied inline, and an inline style beats any stylesheet rule
                # regardless of specificity. Without it these breakpoints parse
                # fine and change nothing.
                block = ";".join(f"{k}:{v} !important" for k, v in props.items())
                if not block:
                    continue
                if tail in SELF_TAILS or tail.endswith("> .elementor-widget-wrap"):
                    sel = f'[data-el="{eid}"]'
                elif "heading-title" in tail:
                    sel = f'[data-el="{eid}"] :is(h1,h2,h3,h4,h5,h6)'
                else:
                    # Pass child selectors through unchanged. The components
                    # carry the Elementor class names these target, so the
                    # breakpoints keep working without a per-widget special case.
                    sel = f'[data-el="{eid}"] {tail.lstrip("> ")}'
                decls.append(f"{sel}{{{block}}}")
        if decls:
            out.append(f"@media{query}{{{''.join(decls)}}}")
    return "".join(out)


def parse_css(path: pathlib.Path) -> dict:
    """element-id -> {sub-selector or '': {prop: value}}, desktop rules only."""
    if not path.exists():
        return {}
    base, _ = split_media(path.read_text(errors="replace"))
    return rules_for(base)


def parse_responsive(path: pathlib.Path) -> str:
    if not path.exists():
        return ""
    _, blocks = split_media(path.read_text(errors="replace"))
    return responsive_css(blocks)


def clean_html(s: str) -> str:
    return (s or "").strip()


def plain(s: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", " ", s or "")).strip()


def img(v):
    if isinstance(v, dict) and v.get("url"):
        return v["url"]
    return None


def hidden_at(st):
    """Elementor's responsive visibility, which emits a class rather than CSS.

    Like the heading size preset, this exists in no stylesheet the extractor
    reads — a spacer hidden on phones kept its 50px there and made every card
    on the home page 50px too tall at mobile.
    """
    out = []
    for key, name in (("hide_desktop", "desktop"), ("hide_tablet", "tablet"),
                      ("hide_mobile", "phone")):
        if st.get(key):
            out.append(name)
    return out or None


def widget_block(node, css):
    st = node.get("settings") or {}
    eid = node.get("id")
    w = node.get("widgetType")
    style = css.get(eid, {})
    b = {"type": w, "id": eid, "style": style, "hide": hidden_at(st)}

    if w == "heading":
        b["text"] = plain(st.get("title", ""))
        b["tag"] = st.get("header_size", "h2")
        b["link"] = (st.get("link") or {}).get("url")
        # Elementor's preset size control. It emits a class, not a declaration,
        # so the size appears nowhere in the page CSS — the home page's audience
        # captions are 'medium' (19px) and rendered 5px too large without it.
        b["size"] = st.get("size") or None
    elif w == "text-editor":
        b["html"] = clean_html(st.get("editor", ""))
    elif w == "image":
        b["src"] = img(st.get("image"))
        b["alt"] = (st.get("image") or {}).get("alt", "")
        b["link"] = (st.get("link") or {}).get("url")
        # Elementor only renders the caption when caption_source is set; with
        # 'attachment' it comes from the media library rather than the widget.
        if st.get("caption_source") in ("custom", "attachment"):
            b["caption"] = plain(st.get("caption", ""))
    elif w == "button":
        b["text"] = st.get("text")
        b["link"] = (st.get("link") or {}).get("url")
    elif w == "icon-box":
        ic = st.get("selected_icon") or {}
        b["icon"] = ic.get("value") if isinstance(ic, dict) else ic
        b["title"] = plain(st.get("title_text", ""))
        b["description"] = plain(st.get("description_text", ""))
        b["link"] = (st.get("link") or {}).get("url")
    elif w == "icon-list":
        b["items"] = [
            {"text": plain(i.get("text", "")), "link": (i.get("link") or {}).get("url")}
            for i in st.get("icon_list", [])
        ]
    elif w == "image-box":
        b["src"] = img(st.get("image"))
        b["title"] = plain(st.get("title_text", ""))
        b["description"] = plain(st.get("description_text", ""))
    elif w in ("image-carousel", "media-carousel"):
        b["images"] = [img(g) for g in st.get("carousel", []) if img(g)]
        b["slidesPerView"] = st.get("slides_per_view")
    elif w == "gallery":
        b["images"] = [img(g) for g in st.get("gallery", []) if img(g)]
    elif w == "testimonial-carousel":
        b["slides"] = [
            {
                "quote": plain(s.get("content", "")),
                "name": plain(s.get("name", "")),
                "detail": plain(s.get("title", "")),
                "image": img(s.get("image")),
            }
            for s in st.get("slides", [])
        ]
        b["slidesPerView"] = st.get("slides_per_view")
    elif w == "video":
        b["url"] = st.get("youtube_url") or st.get("vimeo_url")
    elif w == "form":
        b["formName"] = st.get("form_name")
        b["fields"] = [
            {
                "label": plain(f.get("field_label", "")),
                "type": f.get("field_type", "text"),
                "required": f.get("required") == "true",
                "placeholder": f.get("placeholder"),
                "options": f.get("field_options"),
                "html": f.get("field_html"),
                "id": f.get("custom_id") or f.get("_id"),
            }
            for f in st.get("form_fields", [])
        ]
        b["submit"] = st.get("button_text", "Submit")
    elif w == "shortcode":
        b["shortcode"] = st.get("shortcode")
    elif w == "spacer":
        size = st.get("space") or {}
        b["size"] = size.get("size") if isinstance(size, dict) else None
    elif w == "divider":
        pass
    elif w == "social-icons":
        b["icons"] = [
            {"name": (i.get("social_icon") or {}).get("value"), "link": (i.get("link") or {}).get("url")}
            for i in st.get("social_icon_list", [])
        ]
    elif w == "posts":
        # The widget can list pages rather than posts — /alumni/ uses it to show
        # the ambassador pages. Without the query settings it silently renders
        # recent blog posts instead, which is a different list entirely.
        b["postType"] = st.get("posts_post_type") or "post"
        b["perPage"] = st.get("cards_posts_per_page") or st.get("posts_per_page")
        b["readMore"] = plain(st.get("read_more_text", "")) or None
        inc = st.get("posts_include_term_ids") or st.get("posts_include_ids")
        term_ids = {int(i) for i in inc if str(i).isdigit()} if isinstance(inc, list) else set()
        if term_ids:
            b["items"] = resolve_term(b["postType"], term_ids, b["perPage"])
    return b


def _corpus(kind):
    src = "export/pages.json" if kind == "page" else "export/posts.json"
    return [p for p in json.loads((ROOT / src).read_text())
            if p["status"] == "publish" and not p.get("password_protected")]


def resolve_term(post_type, term_ids, limit):
    """The pages/posts carrying any of these term ids, newest first.

    Elementor filters by term id across every taxonomy, including plugin ones.
    Resolving it here means the rendered list is the same list the live site
    shows, rather than a plausible-looking substitute.
    """
    hits = []
    for p in _corpus(post_type):
        ids = {t["id"] for terms in (p.get("terms") or {}).values() for t in terms}
        if ids & term_ids:
            hits.append(p)
    hits.sort(key=lambda p: p["date"], reverse=True)
    if limit:
        hits = hits[: int(limit)]
    return [
        {
            "title": p["title"],
            "href": re.sub(r"^https?://[^/]+", "", p["permalink"]),
            "image": (p["featured_image"] or {}).get("url")
            if isinstance(p["featured_image"], dict) else p["featured_image"],
            "excerpt": p["excerpt"] or "",
            "date": p["date"],
        }
        for p in hits
    ]


def walk(nodes, css):
    out = []
    for n in nodes or []:
        el = n.get("elType")
        st = n.get("settings") or {}
        eid = n.get("id")
        if el == "widget":
            out.append(widget_block(n, css))
        else:
            block = {
                "type": el,  # section / column / container
                "id": eid,
                "style": css.get(eid, {}),
                "children": walk(n.get("elements"), css),
            }
            if el == "column":
                block["width"] = st.get("_column_size")
            if st.get("background_image"):
                block["bgImage"] = img(st["background_image"])
            if st.get("background_slideshow_gallery"):
                block["slideshow"] = [img(g) for g in st["background_slideshow_gallery"] if img(g)]
            if st.get("structure"):
                block["structure"] = st["structure"]
            out.append(block)
    return out


def build(source: str, out: pathlib.Path, label: str, elementor_only: bool = False):
    items = [p for p in json.loads((ROOT / source).read_text())
             if p["status"] == "publish" and not p.get("password_protected")]
    if elementor_only:
        items = [p for p in items if p["built_with_elementor"]]
    OUT_DIR, index = out, []
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for p in items:
        css = parse_css(ROOT / f"export/pagecss/{p['slug']}.css")
        seo = p["seo"] if isinstance(p["seo"], dict) else {}
        doc = OrderedDict(
            slug=p["slug"],
            title=p["title"],
            path=re.sub(r"^https?://[^/]+", "", p["permalink"]),
            seo={k: v for k, v in seo.items() if v},
            hasCss=bool(css),
            css=parse_responsive(ROOT / f"export/pagecss/{p['slug']}.css"),
            blocks=walk(p["elementor_data"], css),
        )
        (OUT_DIR / f"{p['slug']}.json").write_text(json.dumps(doc, indent=1, ensure_ascii=False))
        index.append({"slug": p["slug"], "title": p["title"], "path": doc["path"], "hasCss": bool(css)})

    (OUT_DIR / "_index.json").write_text(json.dumps(index, indent=1, ensure_ascii=False))
    missing = [i["slug"] for i in index if not i["hasCss"]]
    print(f"wrote {len(index)} {label} files to {OUT_DIR.relative_to(ROOT)}")
    if missing:
        print(f"  no CSS for {len(missing)}: {', '.join(missing[:8])}"
              + (" ..." if len(missing) > 8 else ""))


def main():
    build("export/pages.json", OUT, "page")
    # Elementor-built posts too. Their real content lives in elementor_data; the
    # exported content_raw is only the flattened text, so converting them to MDX
    # keeps the words but loses every image and the layout with them.
    build("export/posts.json", ROOT / "src/content/blogpages", "Elementor post",
          elementor_only=True)


if __name__ == "__main__":
    main()
