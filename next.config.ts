import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Appointments and Tasks are now one Calendar.
  async redirects() {
    return [
      { source: "/appointments", destination: "/calendar", permanent: false },
      { source: "/tasks", destination: "/calendar?view=tasks", permanent: false },
    ];
  },
  async headers() {
    const common = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    ];
    return [
      // The app can't be framed by other sites (clickjacking)…
      { source: "/((?!f/|w/).*)", headers: [...common, { key: "X-Frame-Options", value: "DENY" }, { key: "Content-Security-Policy", value: "frame-ancestors 'none'" }] },
      // Website forms and tools load inside the website's own pages (same site only).
      { source: "/w/:path*", headers: [...common, { key: "X-Frame-Options", value: "SAMEORIGIN" }, { key: "Content-Security-Policy", value: "frame-ancestors 'self'" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      // …except public forms, which are meant to be embedded on MKB's website.
      { source: "/f/:path*", headers: common },
      // Private client links: the token is in the address, so never send it on as a referrer or let it be indexed.
      { source: "/i/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;

// `next dev` gets the Cloudflare bindings (local D1 database, R2, secrets from .dev.vars).
initOpenNextCloudflareForDev();
