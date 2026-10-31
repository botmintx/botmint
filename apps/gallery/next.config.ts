import type { NextConfig } from "next";

const basePath = process.env.BOTMINT_PAGES === "1" ? "/botmint" : "";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

if (basePath) nextConfig.basePath = basePath;

export default nextConfig;
