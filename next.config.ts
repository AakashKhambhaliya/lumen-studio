import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Generated media is served from Higgsfield's CDN (any https host). In
// development the mock API (scripts/mock-higgsfield.mjs) serves http://localhost.
const mediaSources = ["'self'", "data:", "blob:", "https:", ...(isDev ? ["http://localhost:*", "http://127.0.0.1:*"] : [])];

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; dev mode also needs eval for HMR.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src ${mediaSources.join(" ")}`,
  `media-src ${mediaSources.join(" ")}`,
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  typedRoutes: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
