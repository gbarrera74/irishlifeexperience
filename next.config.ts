import type { NextConfig } from "next";
import legacyRedirects from "./src/redirects";

const nextConfig: NextConfig = {
  // WordPress served every URL with a trailing slash (/programs/, /blog/post/).
  // Matching that keeps existing links and search results canonical.
  trailingSlash: true,

  async redirects() {
    return legacyRedirects;
  },
};

export default nextConfig;
