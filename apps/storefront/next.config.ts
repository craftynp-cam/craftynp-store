import type { NextConfig } from "next";

const backendUrl =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";

const backend = new URL(backendUrl);

// Where Medusa's file provider serves uploaded imagery from — the public R2
// bucket in deployment, the MinIO container locally. It is a different origin
// from the backend, so the optimizer has to be told about it separately.
const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
const media = mediaUrl ? new URL(mediaUrl) : null;

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  // Development only. These exist so the local admin and the local Medusa are
  // same-origin on :8000, and nothing in src/ calls either path.
  //
  // In production Medusa serves its own admin at api.thecraftynp.com/app, on
  // its own Cloudflare zone. Proxying it through Vercel would bill every admin
  // request and every label PDF as a function invocation, add a hop, hit
  // Vercel's response-body limit on the PDFs, and undo the zone split the API
  // exists on (see README, "The two zones are split on purpose"). It would not
  // even work: the admin bundle calls /admin/*, /auth/* and /store/*, none of
  // which is rewritten here, so all of them would hit Next and 404.
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

export default nextConfig;
