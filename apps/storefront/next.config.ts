import type { NextConfig } from "next";

const backendUrl =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/:path*`,
      },
      { source: "/app/:path*", destination: `${backendUrl}/app/:path*` },
    ];
  },
};

export default nextConfig;
