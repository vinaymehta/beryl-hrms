import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Minimal, self-contained production image for Docker (see Dockerfile).
  output: "standalone",
};

export default nextConfig;
