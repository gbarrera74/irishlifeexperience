import fs from "node:fs";
import path from "node:path";
import "@/app/footer.css";

/**
 * The live irishway.org footer, reproduced verbatim.
 *
 * The markup is the Elementor footer template (id 622) captured from the live
 * site by scripts/capture_footer.py, rendered as-is. Its stylesheets are
 * captured alongside it in src/app/footer.css. Nothing here is a recreation —
 * re-run the script to pick up changes made in WordPress.
 *
 * Elementor's CSS is namespaced (.elementor-622, .elementor-widget-*, .e-con),
 * so loading it does not affect the rest of the site.
 *
 * Only two things are changed on the way in: upload URLs point at local copies,
 * and Cloudflare's email obfuscation is decoded back to a real mailto link.
 */
const html = fs.readFileSync(
  path.join(process.cwd(), "src/content/footer.html"),
  "utf8",
);

export default function Footer() {
  return (
    <footer className="mt-auto">
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </footer>
  );
}
