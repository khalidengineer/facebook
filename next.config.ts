import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.NODE_ENV === "production" ? "/facebook" : "",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  transpilePackages: ["lucide-react", "date-fns"],
  reactStrictMode: false,
  experimental: {
    cpus: 1,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
