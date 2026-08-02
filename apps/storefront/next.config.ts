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
  async rewrites() {
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
