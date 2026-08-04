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

# Elementor global colour ids -> hex, read from the site kit.
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
)


def resolve(value: str) -> str:
    """Swap var( --e-global-color-x ) for the hex it points at."""
    def sub(m):
        return GLOBALS.get(m.group(1), m.group(0))
    return re.sub(r"var\(\s*--e-global-color-([\w-]+)\s*\)", sub, value or "").strip()


def parse_css(path: pathlib.Path) -> dict:
    """element-id -> {sub-selector or '': {prop: value}}"""
    if not path.exists():
        return {}
    css = path.read_text(errors="replace")
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


def clean_html(s: str) -> str:
    return (s or "").strip()


def plain(s: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", " ", s or "")).strip()


def img(v):
    if isinstance(v, dict) and v.get("url"):
        return v["url"]
    return None


def widget_block(node, css):
    st = node.get("settings") or {}
    eid = node.get("id")
    w = node.get("widgetType")
    style = css.get(eid, {})
    b = {"type": w, "id": eid, "style": style}

    if w == "heading":
        b["text"] = plain(st.get("title", ""))
        b["tag"] = st.get("header_size", "h2")
        b["link"] = (st.get("link") or {}).get("url")
    elif w == "text-editor":
        b["html"] = clean_html(st.get("editor", ""))
    elif w == "image":
        b["src"] = img(st.get("image"))
        b["alt"] = (st.get("image") or {}).get("alt", "")
        b["link"] = (st.get("link") or {}).get("url")
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
    return b


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


def main():
    pages = [p for p in json.loads((ROOT / "export/pages.json").read_text())
             if p["status"] == "publish"]
    OUT.mkdir(parents=True, exist_ok=True)
    index = []

    for p in pages:
        css = parse_css(ROOT / f"export/pagecss/{p['slug']}.css")
        seo = p["seo"] if isinstance(p["seo"], dict) else {}
        doc = OrderedDict(
            slug=p["slug"],
            title=p["title"],
            path=re.sub(r"^https?://[^/]+", "", p["permalink"]),
            seo={k: v for k, v in seo.items() if v},
            hasCss=bool(css),
            blocks=walk(p["elementor_data"], css),
        )
        (OUT / f"{p['slug']}.json").write_text(json.dumps(doc, indent=1, ensure_ascii=False))
        index.append({"slug": p["slug"], "title": p["title"], "path": doc["path"], "hasCss": bool(css)})

    (OUT / "_index.json").write_text(json.dumps(index, indent=1, ensure_ascii=False))
    missing = [i["slug"] for i in index if not i["hasCss"]]
    print(f"wrote {len(index)} page files to {OUT.relative_to(ROOT)}")
    if missing:
        print(f"no CSS for: {', '.join(missing)}")


if __name__ == "__main__":
    main()
