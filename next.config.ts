import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev badge sits bottom left by default, right on top of the
  // "Show the full menu" button when the sidebar is shrunk.
  devIndicators: { position: "bottom-right" },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
