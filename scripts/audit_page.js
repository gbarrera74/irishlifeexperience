/**
 * Page fidelity audit — paste into the browser console (or evaluate via the
 * browser tool) on BOTH the live WordPress page and the Next.js rebuild, then
 * diff the two JSON blobs.
 *
 * Written because building from the Elementor export alone repeatedly produced
 * wrong output: the export only records what an editor explicitly overrode, and
 * panel colours live on wrappers that are easy to miss. Measuring the rendered
 * page is the only reliable source.
 *
 * Rules this encodes, each learned from a real miss:
 *   - walk the ancestor chain for backgrounds (panel colours sit on
 *     .elementor-widget-wrap, not on the section or the widget)
 *   - sample EVERY instance, never just the first (the four Why Us icons are
 *     four different colours; the four cards are four different panels)
 *   - record carousel slides-per-view, arrow and dot counts (loop carousels
 *     have one dot per slide, not one per window)
 */
(() => {
  const c = (e) => getComputedStyle(e);
  const px = (v) => Math.round(parseFloat(v) || 0);
  const rect = (e) => e.getBoundingClientRect();

  const painted = (el) => {
    const s = c(el);
    const o = {};
    if (s.backgroundColor !== "rgba(0, 0, 0, 0)") o.bg = s.backgroundColor;
    if (s.backgroundImage !== "none") o.bgImg = s.backgroundImage.slice(0, 40);
    if (s.borderRadius !== "0px") o.radius = s.borderRadius;
    return Object.keys(o).length ? o : null;
  };

  const typo = (e) =>
    `${c(e).fontSize}/${c(e).fontWeight}/${c(e).color}/${c(e)
      .fontFamily.split(",")[0]
      .replace(/"/g, "")}${c(e).textTransform !== "none" ? " " + c(e).textTransform : ""}`;

  // Works against Elementor markup and against the rebuild.
  const sections = Array.from(
    document.querySelectorAll(".elementor-top-section, main > section, main section > section"),
  ).filter((s, _i, all) => !all.some((o) => o !== s && o.contains(s)));

  return JSON.stringify(
    sections.map((s, i) => ({
      i,
      height: px(rect(s).height),
      bg: c(s).backgroundColor,
      bgImage: c(s).backgroundImage.slice(0, 40),
      padding: c(s).padding,

      // every heading, not just the first
      headings: Array.from(s.querySelectorAll("h1,h2,h3,h4")).map(
        (h) => `${h.tagName} "${h.textContent.trim().slice(0, 30)}" ${typo(h)}`,
      ),

      // distinct painted panels anywhere inside
      panels: [
        ...new Set(
          Array.from(s.querySelectorAll("*"))
            .map(painted)
            .filter(Boolean)
            .map((p) => JSON.stringify(p)),
        ),
      ].slice(0, 8),

      // icons/images, each instance
      icons: Array.from(s.querySelectorAll("svg, i[class*=hm-]")).map(
        (el) => `${el.tagName === "I" ? el.className : "svg"} ${c(el).color} ${px(rect(el).width)}px`,
      ),
      images: Array.from(s.querySelectorAll("img")).map(
        (im) => `${px(rect(im).width)}x${px(rect(im).height)} r=${c(im).borderRadius} fit=${c(im).objectFit}`,
      ),

      buttons: Array.from(s.querySelectorAll("a[class*=button], button, a[href]"))
        .filter((b) => c(b).backgroundColor !== "rgba(0, 0, 0, 0)")
        .map((b) => `"${b.innerText.trim().slice(0, 22)}" ${c(b).backgroundColor} ${typo(b)} r=${c(b).borderRadius}`),

      carousel: (() => {
        const slides = s.querySelectorAll(".swiper-slide, ul li");
        if (!slides.length) return null;
        return {
          slides: slides.length,
          dots: s.querySelectorAll(".swiper-pagination-bullet, button[aria-current]").length,
          arrows: s.querySelectorAll(".elementor-swiper-button, .swiper-button-next, button:not([aria-current])").length,
        };
      })(),
    })),
    null,
    1,
  );
})();
