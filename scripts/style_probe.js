/**
 * Computed-style fingerprint of a rendered page, keyed by text content.
 *
 * Run on the live WordPress page and on the rebuild, then diff. Keying on text
 * rather than on selectors makes the comparison independent of DOM structure,
 * which matters because the rebuild does not reproduce Elementor's wrapper
 * nesting — only its output.
 *
 * For each text-bearing leaf it records the typography actually in effect, plus
 * the nearest painted ancestor background. Elementor paints panel colours on
 * .elementor-widget-wrap rather than on the section or the widget, so reading
 * the element's own background reports transparent and hides card colours.
 */
(() => {
  const norm = (s) =>
    (s || "").replace(/\s+/g, " ").trim().toLowerCase().replace(/[‘’]/g, "'");

  const paintedAncestor = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return bg;
    }
    return "none";
  };

  const main = document.querySelector("main") || document.body;
  const out = {};

  for (const el of main.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,a,span,figcaption,button")) {
    // Leaves only: an element whose text comes from its own children would
    // double-count its descendants.
    if (el.querySelector("h1,h2,h3,h4,h5,h6,p,li,figcaption")) continue;
    const text = norm(el.innerText);
    if (!text || text.length < 4 || text.length > 120) continue;

    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden") continue;

    // First writer wins: repeated strings (nav labels echoed in body copy)
    // otherwise flip-flop between runs.
    if (out[text]) continue;

    out[text] = {
      tag: el.tagName.toLowerCase(),
      size: Math.round(parseFloat(s.fontSize)),
      weight: s.fontWeight,
      family: (s.fontFamily.split(",")[0] || "").replace(/["']/g, ""),
      color: s.color,
      align: s.textAlign,
      transform: s.textTransform,
      bg: paintedAncestor(el),
    };
  }
  return JSON.stringify(out);
})();
