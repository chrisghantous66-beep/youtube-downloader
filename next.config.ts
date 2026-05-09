import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@distube/ytdl-core"],
  devIndicators: false,
};

export default nextConfig;
