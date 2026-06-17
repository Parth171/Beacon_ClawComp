import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this app directory. A stray, empty package-lock.json
  // at the repo root otherwise makes Turbopack infer the monorepo root, which breaks
  // RSC client-module resolution (the "global-error.js ... in the React Client
  // Manifest" error) and prevents client components from hydrating.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
