import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disables the entire linting step during the build process
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disables type checking during the build process
  typescript: {
    ignoreBuildErrors: true,
  },
  // Ensures the build doesn't fail on "Collecting build traces"
  // if there's a minor version mismatch in the environment
  output: 'standalone', 
};

export default nextConfig;