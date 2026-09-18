import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/embed/v1/assets/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Timing-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/embed/v1/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Timing-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
