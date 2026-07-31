import type { NextConfig } from "next";

const backendUrl =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";

const backend = new URL(backendUrl);

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
      {
        protocol: "https",
        hostname: "medusa-public-images.s3.eu-west-1.amazonaws.com",
      },
    ],
  },
};

export default nextConfig;
