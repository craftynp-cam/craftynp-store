import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

const backendUrl =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";

const backend = new URL(backendUrl);

const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
const media = mediaUrl ? new URL(mediaUrl) : null;

const artworkUploadUrl = process.env.NEXT_PUBLIC_ARTWORK_UPLOAD_ORIGIN;
const artworkUpload = artworkUploadUrl ? new URL(artworkUploadUrl) : null;

const STRIPE_JS = "https://js.stripe.com https://*.js.stripe.com";
const STRIPE_LINK = "https://link.com https://*.link.com";

function contentSecurityPolicy(isProduction: boolean): string {
  const connectSources = [
    "'self'",
    backend.origin,
    artworkUpload?.origin,
    "https://api.stripe.com",
    STRIPE_LINK,
    isProduction ? undefined : "ws:",
  ].filter(Boolean);

  const imageSources = [
    "'self'",
    "blob:",
    "data:",
    backend.origin,
    media?.origin,
    "https://*.link.com",
  ].filter(Boolean);

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"} ${STRIPE_JS}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imageSources.join(" ")}`,
    "font-src 'self'",
    `connect-src ${connectSources.join(" ")}`,
    `frame-src ${STRIPE_JS} https://hooks.stripe.com ${STRIPE_LINK}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  async headers() {
    const isProduction = process.env.NODE_ENV === "production";

    return [
      {
        source: "/:path*",
        headers: [
          ...(isProduction
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains",
                },
              ]
            : []),
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy-Report-Only",
            value: contentSecurityPolicy(isProduction),
          },
        ],
      },
    ];
  },
  async rewrites() {
    if (process.env.NODE_ENV === "production") return [];

    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/:path*`,
      },
      { source: "/app/:path*", destination: `${backendUrl}/app/:path*` },
    ];
  },
  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      {
        protocol: backend.protocol.replace(":", "") as "http" | "https",
        hostname: backend.hostname,
        port: backend.port,
      },
      ...(media
        ? [
            {
              protocol: media.protocol.replace(":", "") as "http" | "https",
              hostname: media.hostname,
              port: media.port,
            },
          ]
        : []),
    ],
  },
};

export default function config(phase: string): NextConfig {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
  if (phase === PHASE_PRODUCTION_BUILD && !isAbsoluteHttpUrl(siteUrl)) {
    throw new Error(
      `NEXT_PUBLIC_SITE_URL must be an absolute http(s) URL for a production build, but is "${siteUrl}". Canonical links, social previews, the sitemap and structured data are all built on it.`,
    );
  }

  return nextConfig;
}
