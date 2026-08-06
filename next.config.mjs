/** @type {import('next').NextConfig} */
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Static export is only used for production Electron builds.
// In dev mode we run the normal Next.js server so HMR works.
const isStaticExport = process.env.NEXT_STATIC_EXPORT === '1';

const nextConfig = {
  // Pin the workspace root to THIS project directory.
  // Next.js 16 walks up the filesystem to find the outermost package.json/lockfile
  // and uses that as the root for CSS @import resolution, breaking packages
  // installed in fikr-studio/node_modules when running inside a monorepo.
  outputFileTracingRoot: __dirname,
  ...(isStaticExport && {
    output: "export",
    distDir: "out",
    assetPrefix: "./",
  }),
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig
