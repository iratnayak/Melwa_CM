import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const clientRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Parent repo has its own package-lock; pin Turbopack root to this app.
  turbopack: {
    root: clientRoot,
  },
};

export default nextConfig;
