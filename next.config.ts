import type { NextConfig } from "next";

const isExport = process.env.GITHUB_ACTIONS === "true" || process.env.NEXT_EXPORT === "true";

const nextConfig: NextConfig = {
  ...(isExport
    ? {
        output: "export",
        basePath: "/facebook",
        trailingSlash: true,
        images: {
          unoptimized: true,
        },
      }
    : {}),
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
