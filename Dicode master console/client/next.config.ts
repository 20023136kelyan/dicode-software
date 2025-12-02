import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  // API routes are handled by Cloud Functions via functions/src/index.ts
  trailingSlash: true, // Helps with Firebase Hosting
};

export default nextConfig;
