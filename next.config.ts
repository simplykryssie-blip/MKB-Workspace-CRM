import type { NextConfig } from "next";

// Phase 1 (design): frontend only, no backend, no deployment target wired up.
// Cloudflare (via @opennextjs/cloudflare) is added in Phase 3 after approval.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
